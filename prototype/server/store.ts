import fs from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

import { config } from "./config.js";
import type { StoreData } from "./types.js";

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
let sqlClient: ReturnType<typeof neon> | undefined;
let postgresReady: Promise<void> | undefined;

function normalizeStoreData(data: unknown): StoreData {
  if (!data || typeof data !== "object") {
    return initialData;
  }

  return { ...initialData, ...(data as Partial<StoreData>) };
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(config.dataPath), { recursive: true });

  try {
    await fs.access(config.dataPath);
  } catch {
    await fs.writeFile(config.dataPath, JSON.stringify(initialData, null, 2));
  }
}

function getSqlClient() {
  if (!config.postgresUrl) {
    throw new Error("Postgres store selected, but no WERRA_POSTGRES_URL, POSTGRES_URL, or DATABASE_URL is configured");
  }

  sqlClient ??= neon(config.postgresUrl);
  return sqlClient;
}

async function ensurePostgresStore() {
  postgresReady ??= (async () => {
    const sql = getSqlClient();

    await sql.query(`
      CREATE TABLE IF NOT EXISTS werra_poc_store (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await sql.query(
      `
        INSERT INTO werra_poc_store (key, data)
        VALUES ($1, $2::jsonb)
        ON CONFLICT (key) DO NOTHING
      `,
      [config.storeKey, JSON.stringify(initialData)],
    );
  })();

  return postgresReady;
}

async function readPostgresStore(): Promise<StoreData> {
  await ensurePostgresStore();
  const sql = getSqlClient();
  const rows = (await sql.query("SELECT data FROM werra_poc_store WHERE key = $1", [
    config.storeKey,
  ])) as Array<{ data: unknown }>;

  return normalizeStoreData(rows[0]?.data);
}

async function writePostgresStore(data: StoreData) {
  await ensurePostgresStore();
  const sql = getSqlClient();

  await sql.query(
    `
      INSERT INTO werra_poc_store (key, data, version, updated_at)
      VALUES ($1, $2::jsonb, 1, NOW())
      ON CONFLICT (key) DO UPDATE
        SET data = EXCLUDED.data,
            version = werra_poc_store.version + 1,
            updated_at = NOW()
    `,
    [config.storeKey, JSON.stringify(data)],
  );
}

async function updatePostgresStore(mutator: (data: StoreData) => StoreData | Promise<StoreData>) {
  await ensurePostgresStore();
  const sql = getSqlClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rows = (await sql.query("SELECT data, version FROM werra_poc_store WHERE key = $1", [
      config.storeKey,
    ])) as Array<{ data: unknown; version: number }>;
    const row = rows[0];
    const data = normalizeStoreData(row?.data);
    const version = row?.version ?? 0;
    const next = await mutator(data);

    const updatedRows = (await sql.query(
      `
        UPDATE werra_poc_store
        SET data = $1::jsonb,
            version = version + 1,
            updated_at = NOW()
        WHERE key = $2 AND version = $3
        RETURNING version
      `,
      [JSON.stringify(next), config.storeKey, version],
    )) as Array<{ version: number }>;

    if (updatedRows.length > 0) {
      return next;
    }

    await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
  }

  throw new Error("Store update conflict. Please retry the action.");
}

export async function readStore(): Promise<StoreData> {
  if (config.storeDriver === "postgres") {
    return readPostgresStore();
  }

  await ensureStoreFile();
  const raw = await fs.readFile(config.dataPath, "utf8");
  return normalizeStoreData(JSON.parse(raw));
}

export async function writeStore(data: StoreData) {
  if (config.storeDriver === "postgres") {
    writeQueue = writeQueue.then(() => writePostgresStore(data));
    await writeQueue;
    return;
  }

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
  if (config.storeDriver === "postgres") {
    const update = writeQueue.then(() => updatePostgresStore(mutator));

    writeQueue = update.then(
      () => undefined,
      () => undefined,
    );

    return update;
  }

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
