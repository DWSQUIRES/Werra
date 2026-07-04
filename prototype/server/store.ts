import fs from "node:fs/promises";
import path from "node:path";

import { config } from "./config";
import type { StoreData } from "./types";

const initialData: StoreData = {
  users: [],
  briefs: [],
  bids: [],
  agreements: [],
  escrows: [],
  deliveries: [],
  disputes: [],
};

let writeQueue = Promise.resolve();

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(config.dataPath), { recursive: true });

  try {
    await fs.access(config.dataPath);
  } catch {
    await fs.writeFile(config.dataPath, JSON.stringify(initialData, null, 2));
  }
}

export async function readStore(): Promise<StoreData> {
  await ensureStoreFile();
  const raw = await fs.readFile(config.dataPath, "utf8");
  return { ...initialData, ...(JSON.parse(raw) as Partial<StoreData>) };
}

export async function writeStore(data: StoreData) {
  writeQueue = writeQueue.then(() => writeStoreFile(data));
  await writeQueue;
}

async function writeStoreFile(data: StoreData) {
  await ensureStoreFile();
  const tempPath = `${config.dataPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tempPath, config.dataPath);
}

export async function updateStore(mutator: (data: StoreData) => StoreData | Promise<StoreData>) {
  const update = writeQueue.then(async () => {
    const data = await readStore();
    const next = await mutator(data);
    await writeStoreFile(next);
    return next;
  });

  writeQueue = update.then(
    () => undefined,
    () => undefined,
  );

  return update;
}
