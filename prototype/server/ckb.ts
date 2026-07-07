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
const minimumCellCapacity = ccc.fixedPointFrom(61);

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

function walletLock(wallet: ManagedWallet) {
  return ccc.Script.from(wallet.lockScript);
}

function parseCkbAmount(amount: string | number) {
  const raw = String(amount).trim();

  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error("CKB amount must be a positive decimal string");
  }

  const capacity = ccc.fixedPointFrom(raw);

  if (capacity < minimumCellCapacity) {
    throw new Error("CKB funding amount must be at least 61 CKB");
  }

  return capacity;
}

function getFaucetSigner() {
  if (!config.ckbFaucetPrivateKey) {
    throw new Error("CKB gas sponsorship is not configured for this deployment");
  }

  return new ccc.SignerCkbPrivateKey(ckbClient, config.ckbFaucetPrivateKey);
}

export async function getCkbFaucetStatus() {
  if (!config.ckbFaucetPrivateKey) {
    return {
      enabled: false,
      network: config.chainNetwork,
    };
  }

  const signer = getFaucetSigner();
  const address = await signer.getAddressObjSecp256k1();
  const capacityShannons = await ckbClient.getBalanceSingle(address.script);

  return {
    enabled: true,
    network: config.chainNetwork,
    address: address.toString(),
    capacityShannons: capacityShannons.toString(),
    capacityCkb: ccc.fixedPointToString(capacityShannons),
    checkedAt: new Date().toISOString(),
  };
}

export async function fundManagedWalletsCkb(outputs: Array<{ wallet: ManagedWallet; amount: string | number }>) {
  if (outputs.length === 0) {
    throw new Error("At least one wallet is required for CKB funding");
  }

  const faucet = getFaucetSigner();
  const plannedOutputs = [];

  for (const output of outputs) {
    const targetCapacity = parseCkbAmount(output.amount);
    const currentCapacity = await ckbClient.getBalanceSingle(walletLock(output.wallet));

    if (currentCapacity < targetCapacity) {
      plannedOutputs.push({ wallet: output.wallet, capacity: targetCapacity });
    }
  }

  if (plannedOutputs.length === 0) {
    return { txHash: null, fundedWallets: 0 };
  }

  const tx = ccc.Transaction.from({});

  plannedOutputs.forEach((output) => {
    tx.addOutput({
      capacity: output.capacity,
      lock: walletLock(output.wallet),
    });
  });

  await tx.completeInputsByCapacity(faucet);
  await tx.completeFeeBy(faucet);

  return { txHash: await faucet.sendTransaction(tx), fundedWallets: plannedOutputs.length };
}
