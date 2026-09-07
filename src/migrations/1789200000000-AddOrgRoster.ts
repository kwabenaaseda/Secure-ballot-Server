import { MigrationInterface, QueryRunner } from 'typeorm';

// BYOI roster import — per-org authoritative member list uploaded by the org
// admin (CSV/database export). Join requests matching an unclaimed roster row
// (by account email) are auto-activated instead of pending manual review.
export class AddOrgRoster1789200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "org_roster_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "org_id" uuid NOT NULL,
        "email" character varying,
        "custom_data" jsonb NOT NULL DEFAULT '{}',
        "status" character varying NOT NULL DEFAULT 'unclaimed',
        "matched_user_id" uuid,
        "claimed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_roster_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_org_roster_entries_org" FOREIGN KEY ("org_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_org_roster_org_email" UNIQUE ("org_id", "email")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_org_roster_entries_org_id" ON "org_roster_entries" ("org_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "org_roster_entries"`);
  }
}
