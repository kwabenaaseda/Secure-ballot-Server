import { MigrationInterface, QueryRunner } from 'typeorm';

// Tier 0.4 — SYSTEM_ADMIN tokens have no users-table row, so the blacklist's
// user_id FK must be nullable for admin logout to work.
export class MakeTokenBlacklistUserOptional1788500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE token_blacklist ALTER COLUMN user_id DROP NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only safe if no admin (user_id IS NULL) rows exist.
    await queryRunner.query(
      `DELETE FROM token_blacklist WHERE user_id IS NULL;
       ALTER TABLE token_blacklist ALTER COLUMN user_id SET NOT NULL;`,
    );
  }
}
