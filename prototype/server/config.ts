import crypto from "node:crypto";
import path from "node:path";

export type ChainNetwork = "testnet" | "devnet";
export type StoreDriver = "file" | "postgres";

const defaultDataPath = path.join(process.cwd(), ".werra-poc", "store.json");
const vercelDataPath = path.join("/tmp", "werra-poc-store.json");
const defaultDevSecret = "werra-poc-managed-wallet-dev-secret";
const isVercel = process.env.VERCEL === "1";
const postgresUrl =
  process.env.WERRA_POSTGRES_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.DATABASE_URL;
const requestedStoreDriver = process.env.WERRA_STORE_DRIVER;

function resolveStoreDriver(): StoreDriver {
  if (requestedStoreDriver === "file" || requestedStoreDriver === "postgres") {
    return requestedStoreDriver;
  }

  if (requestedStoreDriver) {
    throw new Error("WERRA_STORE_DRIVER must be either file or postgres");
  }

  return postgresUrl ? "postgres" : "file";
}

export const config = {
  port: Number(process.env.WERRA_API_PORT ?? 5174),
  dataPath: process.env.WERRA_DATA_PATH ?? (isVercel ? vercelDataPath : defaultDataPath),
  postgresUrl,
  storeDriver: resolveStoreDriver(),
  storeKey: process.env.WERRA_STORE_KEY ?? "werra-poc",
  chainNetwork: (process.env.CKB_NETWORK ?? "testnet") as ChainNetwork,
  ckbRpcUrl: process.env.CKB_RPC_URL,
  encryptionKey: crypto
    .createHash("sha256")
    .update(process.env.WERRA_WALLET_ENCRYPTION_KEY ?? defaultDevSecret)
    .digest(),
  usingDefaultDevSecret: !process.env.WERRA_WALLET_ENCRYPTION_KEY,
};
