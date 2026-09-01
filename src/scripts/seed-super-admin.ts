// Run once: bun run src/scripts/seed-super-admin.ts
// Creates the first super_admin so the /auth/admin/onboard route has
// someone able to call it. After this, no more direct DB/script access
// is needed — new admins come through the onboard endpoint.

import { AppDataSource } from '../config/database';
import { SystemAdmin } from '../entities/SystemAdmin';
import { Hash_Password } from '../utils/auth';
import { Log } from '../utils/Logger';

async function main() {
  await AppDataSource.initialize();

  const email = process.env.SEED_ADMIN_EMAIL;
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !username || !password) {
    Log.error(
      'SeedSuperAdmin',
      'SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD must be set.',
      'SEED'
    );
    process.exit(1);
  }

  const repo = AppDataSource.getRepository(SystemAdmin);
  const existing = await repo.findOne({ where: [{ email }, { username }] });
  if (existing) {
    Log.info('SeedSuperAdmin', 'Super admin already exists. Skipping.', 'SEED');
    process.exit(0);
  }

  const password_hash = await Hash_Password(password);
  const admin = repo.create({
    email,
    username,
    password_hash,
    level: 'super_admin',
    status: 'active',
    created_by: null,
  });
  await repo.save(admin);

  Log.info('SeedSuperAdmin', `Super admin created: ${username} (${email})`, 'SEED');
  process.exit(0);
}

main();
