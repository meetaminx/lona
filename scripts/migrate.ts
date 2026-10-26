import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  // Prefer the direct (unpooled) connection for schema changes; Neon provides both.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    if (process.env.VERCEL) {
      console.error("DATABASE_URL is not set. Connect the Neon database to this project in Vercel (Storage, Connect Project).");
      process.exit(1);
    }
    console.log("DATABASE_URL is not a Postgres URL. Local PGlite migrates itself on boot, nothing to do.");
    return;
  }
  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await client.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
