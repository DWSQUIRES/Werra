import { rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";

const apiPort = process.env.WERRA_API_PORT ?? "5174";
const frontendPort = process.env.WERRA_FRONTEND_PORT ?? "5173";
const dataPath = process.env.WERRA_DATA_PATH ?? ".werra-poc/preview-store.json";
const reset = process.argv.includes("--reset");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const appUrl = `http://127.0.0.1:${frontendPort}`;

const children = [];
let usdAttemptInFlight = false;
let usdIssued = false;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? code}`));
    });
  });
}

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  children.push(child);
  return child;
}

function stop() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

async function fetchJson(path, options) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : `${path} failed`);
  }

  return body;
}

async function waitForApi() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30_000) {
    try {
      await fetchJson("/api/health");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error("API did not become ready within 30 seconds");
}

function formatWallets(wallets) {
  const rows = [
    ["Demo SME", wallets.business?.user],
    ["USDW issuer / Admin", wallets.issuer?.user],
    ["Werra escrow custody", wallets.escrow?.user],
    ["Demo Creator", wallets.creator?.user],
  ];

  return rows
    .map(([label, user]) => `${label.padEnd(22)} ${user?.wallet.address ?? "not created"}`)
    .join("\n");
}

async function getCkb(userId) {
  const { balance } = await fetchJson(`/api/users/${userId}/ckb-balance`);
  return Number(balance.capacityCkb);
}

async function getUsdw(userId) {
  const { balance } = await fetchJson(`/api/users/${userId}/usdw-balance`);
  return Number(balance.amount);
}

async function maybeIssueDemoUsdw(wallets) {
  if (usdIssued || usdAttemptInFlight || !wallets.business?.user || !wallets.issuer?.user) {
    return;
  }

  usdAttemptInFlight = true;

  try {
    const [issuerCkb, businessUsdw] = await Promise.all([
      getCkb(wallets.issuer.user.id),
      getUsdw(wallets.business.user.id),
    ]);

    if (businessUsdw >= 500) {
      usdIssued = true;
      return;
    }

    if (issuerCkb < 100) {
      return;
    }

    console.log("\nIssuer wallet has CKB. Issuing 1000 USDW to the Demo SME...");
    const { txHash } = await fetchJson("/api/usdw/issue", {
      method: "POST",
      body: JSON.stringify({
        recipientId: wallets.business.user.id,
        amount: "1000",
      }),
    });
    usdIssued = true;
    console.log(`USDW issued. Tx: ${txHash}`);
  } catch (error) {
    if (!/Insufficient CKB|Insufficient capacity|not enough/i.test(String(error.message))) {
      console.log(`USDW auto-issue waiting: ${error.message}`);
    }
  } finally {
    usdAttemptInFlight = false;
  }
}

async function main() {
  console.log("\nWerra community preview launcher\n");

  if (reset) {
    await rm(dataPath, { force: true });
    console.log(`Reset local POC store: ${dataPath}`);
  }

  if (!(await exists("node_modules/.bin/vite")) || !(await exists("node_modules/.bin/tsx"))) {
    console.log("Installing dependencies...");
    await run(npmCommand, ["install"]);
  }

  const api = start(npmCommand, ["run", "api"], {
    env: {
      ...process.env,
      WERRA_API_PORT: apiPort,
      WERRA_DATA_PATH: dataPath,
    },
  });

  api.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      stop();
      process.exit(code ?? 1);
    }
  });

  await waitForApi();
  const { wallets } = await fetchJson("/api/poc/wallets", { method: "POST" });

  console.log("\nOpen the POC:");
  console.log(`  ${appUrl}`);
  console.log("\nFund these CKB testnet addresses for the full chain-backed flow:");
  console.log(formatWallets(wallets));
  console.log("\nSuggested testnet funding:");
  console.log("  - Demo SME: 500 CKB");
  console.log("  - USDW issuer / Admin: 300 CKB");
  console.log("  - Werra escrow custody: 300 CKB");
  console.log("  - Demo Creator: optional for this POC");
  console.log("\nAfter the issuer wallet is funded, this launcher will auto-issue 1000 USDW to the Demo SME.");
  console.log("Use Ctrl+C to stop both servers.\n");

  const frontend = start(npmCommand, ["run", "dev", "--", "--host", "127.0.0.1", "--port", frontendPort], {
    env: process.env,
  });

  frontend.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      stop();
      process.exit(code ?? 1);
    }
  });

  await maybeIssueDemoUsdw(wallets);
  setInterval(() => void maybeIssueDemoUsdw(wallets), 20_000);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stop();
    process.exit(0);
  });
}

main().catch((error) => {
  stop();
  console.error(error);
  process.exit(1);
});
