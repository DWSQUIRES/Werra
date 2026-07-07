import { ccc } from "@ckb-ccc/core";

import { decryptSecret } from "./crypto.js";
import { buildCkbFundingOutput, ckbClient, type PlannedCkbFundingOutput } from "./ckb.js";
import type { ManagedWallet } from "./types.js";

export const USDW = {
  symbol: "USDW",
  name: "Werra Test USD",
  decimals: 6,
  issuerEmail: "demo-issuer@werra.local",
  escrowEmail: "demo-escrow@werra.local",
};

const udtMax = 2n ** 128n - 1n;
const usdwScale = 10n ** BigInt(USDW.decimals);
const releaseFeeReserve = ccc.fixedPointFrom(1);

export type UsdwTransferOutput = {
  wallet: ManagedWallet;
  amountUnits: bigint;
  capacityReserveShannons?: bigint;
};

function walletLock(wallet: ManagedWallet) {
  return ccc.Script.from(wallet.lockScript);
}

function walletSigner(wallet: ManagedWallet) {
  return new ccc.SignerCkbPrivateKey(ckbClient, decryptSecret(wallet.encryptedPrivateKey));
}

export function parseUsdwAmount(amount: string | number) {
  const raw = String(amount).trim();

  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error("USDW amount must be a positive decimal string");
  }

  const [whole, fraction = ""] = raw.split(".");

  if (fraction.length > USDW.decimals) {
    throw new Error(`USDW supports ${USDW.decimals} decimal places`);
  }

  const units = BigInt(whole) * usdwScale + BigInt(fraction.padEnd(USDW.decimals, "0"));

  if (units <= 0n) {
    throw new Error("USDW amount must be greater than zero");
  }

  return units;
}

export function formatUsdwAmount(units: bigint) {
  const whole = units / usdwScale;
  const fraction = (units % usdwScale).toString().padStart(USDW.decimals, "0");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole.toString();
}

export function encodeUdtAmount(units: bigint) {
  if (units < 0n || units > udtMax) {
    throw new Error("UDT amount is outside uint128 range");
  }

  const bytes = Buffer.alloc(16);
  let remaining = units;

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return `0x${bytes.toString("hex")}`;
}

export function decodeUdtAmount(data: string) {
  return ccc.udtBalanceFrom(data);
}

export async function getUsdwTypeScript(issuerWallet: ManagedWallet) {
  return ccc.Script.fromKnownScript(ckbClient, ccc.KnownScript.XUdt, walletLock(issuerWallet).hash());
}

export async function getUsdwTokenInfo(issuerWallet: ManagedWallet) {
  const typeScript = await getUsdwTypeScript(issuerWallet);

  return {
    ...USDW,
    ownerLockHash: walletLock(issuerWallet).hash(),
    issuerAddress: issuerWallet.address,
    typeScript: {
      codeHash: typeScript.codeHash,
      hashType: typeScript.hashType,
      args: typeScript.args,
    },
  };
}

export async function getUsdwBalance(wallet: ManagedWallet, issuerWallet: ManagedWallet) {
  const typeScript = await getUsdwTypeScript(issuerWallet);
  let units = 0n;

  for await (const cell of ckbClient.findCellsByLock(walletLock(wallet), typeScript, true)) {
    units += decodeUdtAmount(cell.outputData);
  }

  return {
    symbol: USDW.symbol,
    decimals: USDW.decimals,
    amountUnits: units.toString(),
    amount: formatUsdwAmount(units),
    checkedAt: new Date().toISOString(),
  };
}

function buildUdtOutput({ wallet, amountUnits, capacityReserveShannons = 0n }: UsdwTransferOutput, typeScript: ccc.Script) {
  const outputData = encodeUdtAmount(amountUnits);
  const cell = ccc.CellAny.from({
    cellOutput: {
      lock: walletLock(wallet),
      type: typeScript,
    },
    outputData,
  });

  cell.cellOutput.capacity += capacityReserveShannons;
  return cell;
}

export async function issueUsdw({
  issuerWallet,
  recipientWallet,
  amountUnits,
}: {
  issuerWallet: ManagedWallet;
  recipientWallet: ManagedWallet;
  amountUnits: bigint;
}) {
  const issuer = walletSigner(issuerWallet);
  const typeScript = await getUsdwTypeScript(issuerWallet);
  const tx = ccc.Transaction.from({});

  await tx.addCellDepsOfKnownScripts(ckbClient, ccc.KnownScript.XUdt);
  tx.addOutput(buildUdtOutput({ wallet: recipientWallet, amountUnits }, typeScript));
  await tx.completeInputsByCapacity(issuer);
  await tx.completeFeeBy(issuer);

  return issuer.sendTransaction(tx);
}

export async function issueUsdwAndFundCkb({
  issuerWallet,
  usdwOutputs,
  ckbOutputs,
}: {
  issuerWallet: ManagedWallet;
  usdwOutputs: UsdwTransferOutput[];
  ckbOutputs: PlannedCkbFundingOutput[];
}) {
  if (usdwOutputs.length === 0 && ckbOutputs.length === 0) {
    return null;
  }

  const issuer = walletSigner(issuerWallet);
  const typeScript = await getUsdwTypeScript(issuerWallet);
  const tx = ccc.Transaction.from({});

  await tx.addCellDepsOfKnownScripts(ckbClient, ccc.KnownScript.XUdt);
  ckbOutputs.forEach((output) => tx.addOutput(buildCkbFundingOutput(output)));
  usdwOutputs.forEach((output) => tx.addOutput(buildUdtOutput(output, typeScript)));
  await tx.completeInputsByCapacity(issuer);
  await tx.completeFeeBy(issuer);

  return issuer.sendTransaction(tx);
}

export async function transferUsdw({
  fromWallet,
  issuerWallet,
  outputs,
}: {
  fromWallet: ManagedWallet;
  issuerWallet: ManagedWallet;
  outputs: UsdwTransferOutput[];
}) {
  const sender = walletSigner(fromWallet);
  const typeScript = await getUsdwTypeScript(issuerWallet);
  const tx = ccc.Transaction.from({});

  await tx.addCellDepsOfKnownScripts(ckbClient, ccc.KnownScript.XUdt);
  outputs.forEach((output) => tx.addOutput(buildUdtOutput(output, typeScript)));

  await tx.completeInputsByUdt(sender, typeScript);

  const inputUnits = await tx.getInputsUdtBalance(ckbClient, typeScript);
  const outputUnits = tx.getOutputsUdtBalance(typeScript);
  const changeUnits = inputUnits - outputUnits;

  if (changeUnits < 0n) {
    throw new Error("Insufficient USDW balance");
  }

  if (changeUnits > 0n) {
    tx.addOutput(buildUdtOutput({ wallet: fromWallet, amountUnits: changeUnits }, typeScript));
  }

  await tx.completeInputsByCapacity(sender);
  await tx.completeFeeBy(sender);

  return sender.sendTransaction(tx);
}

export const usdwReleaseFeeReserveShannons = releaseFeeReserve;
