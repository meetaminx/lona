import path from "node:path";
import { mkdirSync } from "node:fs";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

// One connection per server instance, kept across hot reloads in development.
const globalForDb = globalThis as unknown as { __lonaDb?: Promise<DB> };

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;

  if (url && /^postgres(ql)?:\/\//.test(url)) {
    // Neon or any Postgres. Run `npm run db:migrate` on deploy.
    const client = postgres(url, { prepare: false, max: 5 });
    return drizzlePg(client, { schema });
  }

  // Local development and tests: embedded Postgres (PGlite), migrated on boot.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = url?.startsWith("pglite://") ? url.slice("pglite://".length) : path.join(process.cwd(), ".data", "pglite");
  if (dataDir !== "memory") mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = dataDir === "memory" ? new PGlite() : new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db as unknown as DB;
}

export function db(): Promise<DB> {
  if (!globalForDb.__lonaDb) {
    globalForDb.__lonaDb = connect().catch((err) => {
      globalForDb.__lonaDb = undefined; // let the next request retry
      throw err;
    });
  }
  return globalForDb.__lonaDb;
}

export { schema };
