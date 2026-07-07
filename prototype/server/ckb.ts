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

export function walletLock(wallet: Pick<ManagedWallet, "lockScript">) {
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

export type PlannedCkbFundingOutput = {
  wallet: ManagedWallet;
  capacity: bigint;
};

function getFaucetSigner() {
  if (!config.ckbFaucetPrivateKey) {
    throw new Error("CKB gas sponsorship is not configured for this deployment");
  }

  return new ccc.SignerCkbPrivateKey(ckbClient, config.ckbFaucetPrivateKey);
}

export async function getConfiguredFaucetWallet(): Promise<ManagedWallet | null> {
  if (!config.ckbFaucetPrivateKey) {
    return null;
  }

  const signer = getFaucetSigner();
  const address = await signer.getAddressObjSecp256k1();

  return {
    address: address.toString(),
    publicKey: signer.publicKey,
    lockScript: {
      codeHash: address.script.codeHash,
      hashType: address.script.hashType,
      args: address.script.args,
    },
    encryptedPrivateKey: encryptSecret(config.ckbFaucetPrivateKey),
    createdAt: new Date().toISOString(),
  };
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

export async function planManagedWalletsCkbFunding(
  outputs: Array<{ wallet: ManagedWallet; amount: string | number }>,
): Promise<PlannedCkbFundingOutput[]> {
  if (outputs.length === 0) {
    throw new Error("At least one wallet is required for CKB funding");
  }

  const plannedOutputs: PlannedCkbFundingOutput[] = [];

  for (const output of outputs) {
    const targetCapacity = parseCkbAmount(output.amount);
    const currentCapacity = await ckbClient.getBalanceSingle(walletLock(output.wallet));
    const requiredCapacity = targetCapacity - currentCapacity;

    if (requiredCapacity > 0n) {
      plannedOutputs.push({
        wallet: output.wallet,
        capacity: requiredCapacity < minimumCellCapacity ? minimumCellCapacity : requiredCapacity,
      });
    }
  }

  return plannedOutputs;
}

export function buildCkbFundingOutput(output: PlannedCkbFundingOutput) {
  return {
    capacity: output.capacity,
    lock: walletLock(output.wallet),
  };
}

export async function fundManagedWalletsCkb(outputs: Array<{ wallet: ManagedWallet; amount: string | number }>) {
  const plannedOutputs = await planManagedWalletsCkbFunding(outputs);

  if (plannedOutputs.length === 0) {
    return { txHash: null, fundedWallets: 0 };
  }

  const faucet = getFaucetSigner();

  const tx = ccc.Transaction.from({});

  plannedOutputs.forEach((output) => {
    tx.addOutput(buildCkbFundingOutput(output));
  });

  await tx.completeInputsByCapacity(faucet);
  await tx.completeFeeBy(faucet);

  return { txHash: await faucet.sendTransaction(tx), fundedWallets: plannedOutputs.length };
}
