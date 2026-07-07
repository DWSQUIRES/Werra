import crypto from "node:crypto";
import { ccc } from "@ckb-ccc/core";

import { config } from "./config.js";
import { encryptSecret } from "./crypto.js";
import type { ManagedWallet } from "./types.js";

function buildClient() {
  if (config.chainNetwork === "testnet") {
    return config.ckbRpcUrl
      ? new ccc.ClientPublicTestnet({ url: config.ckbRpcUrl })
      : new ccc.ClientPublicTestnet();
  }

  return new ccc.ClientPublicTestnet({
    url: config.ckbRpcUrl ?? "http://127.0.0.1:28114",
  });
}

export const ckbClient = buildClient();

function createPrivateKey() {
  return `0x${crypto.randomBytes(32).toString("hex")}`;
}

export async function createManagedWallet(): Promise<ManagedWallet> {
  const privateKey = createPrivateKey();
  const signer = new ccc.SignerCkbPrivateKey(ckbClient, privateKey);
  const address = await signer.getAddressObjSecp256k1();

  return {
    address: address.toString(),
    publicKey: signer.publicKey,
    lockScript: {
      codeHash: address.script.codeHash,
      hashType: address.script.hashType,
      args: address.script.args,
    },
    encryptedPrivateKey: encryptSecret(privateKey),
    createdAt: new Date().toISOString(),
  };
}

export function toPublicWallet(wallet: ManagedWallet) {
  const { encryptedPrivateKey, ...publicWallet } = wallet;
  return publicWallet;
}

export async function getWalletCkbBalance(wallet: Pick<ManagedWallet, "lockScript">) {
  const capacityShannons = await ckbClient.getBalanceSingle(wallet.lockScript);

  return {
    capacityShannons: capacityShannons.toString(),
    capacityCkb: ccc.fixedPointToString(capacityShannons),
    checkedAt: new Date().toISOString(),
    network: config.chainNetwork,
  };
}
