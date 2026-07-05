import crypto from "node:crypto";
import path from "node:path";

export type ChainNetwork = "testnet" | "devnet";

const defaultDataPath = path.join(process.cwd(), ".werra-poc", "store.json");
const vercelDataPath = path.join("/tmp", "werra-poc-store.json");
const defaultDevSecret = "werra-poc-managed-wallet-dev-secret";
const isVercel = process.env.VERCEL === "1";

export const config = {
  port: Number(process.env.WERRA_API_PORT ?? 5174),
  dataPath: process.env.WERRA_DATA_PATH ?? (isVercel ? vercelDataPath : defaultDataPath),
  chainNetwork: (process.env.CKB_NETWORK ?? "testnet") as ChainNetwork,
  ckbRpcUrl: process.env.CKB_RPC_URL,
  encryptionKey: crypto
    .createHash("sha256")
    .update(process.env.WERRA_WALLET_ENCRYPTION_KEY ?? defaultDevSecret)
    .digest(),
  usingDefaultDevSecret: !process.env.WERRA_WALLET_ENCRYPTION_KEY,
};
