// src/scripts/run-migrations.ts
import { AppDataSource } from "../config/database";

async function run() {
  await AppDataSource.initialize();
  console.log("✅ Data source initialized.");

  const migrations = await AppDataSource.runMigrations();

  if (migrations.length === 0) {
    console.log("No pending migrations.");
  } else {
    console.log(`✅ Ran ${migrations.length} migration(s):`);
    migrations.forEach((m) => console.log(`  - ${m.name}`));
  }

  await AppDataSource.destroy();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration run failed:", err);
  process.exit(1);
});