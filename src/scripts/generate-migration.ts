import { execSync } from "child_process";

const migrationName = process.argv[2];

if (!migrationName) {
  console.error("❌ Please provide a migration name! e.g., bun run migration:generate CreateEntities");
  process.exit(1);
}

try {
  // We execute the underlying TypeORM CLI file directly with 'bun' 
  // to force the execution context to remain entirely inside Bun.
  const cmd = `bun node_modules/typeorm/cli.js migration:generate src/migrations/${migrationName} -d src/config/database.ts`;
  
  console.log(`🚀 Invoking Bun-enforced TypeORM execution layer...`);
  console.log(`Running: ${cmd}\n`);
  
  execSync(cmd, { stdio: "inherit" });
  
  console.log("\n✅ Migration generated successfully!");
} catch (error) {
  console.error("\n❌ Migration generation failed.");
}