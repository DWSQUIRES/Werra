import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const e2eStorePath = ".werra-poc/e2e-store.json";

await rm(e2eStorePath, { force: true });

const children = [
  spawn("npm", ["run", "api"], {
    env: {
      ...process.env,
      WERRA_API_PORT: "5174",
      WERRA_DATA_PATH: e2eStorePath,
    },
    stdio: "inherit",
  }),
  spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1"], {
    env: process.env,
    stdio: "inherit",
  }),
];

function stop() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stop();
    process.exit(0);
  });
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      stop();
      process.exit(code ?? 1);
    }
  });
}
