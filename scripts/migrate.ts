import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
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
