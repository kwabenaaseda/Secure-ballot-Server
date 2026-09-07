import { MigrationInterface, QueryRunner } from 'typeorm';

// Notification infrastructure — per-user preference columns on users plus the
// in-app notifications table that the client bell icon reads.
export class AddNotifications1789100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"
         ADD COLUMN "notify_election_reminders" boolean NOT NULL DEFAULT true,
         ADD COLUMN "notify_approval_updates" boolean NOT NULL DEFAULT true`,
    );

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "link" character varying,
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_id" ON "notifications" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(
      `ALTER TABLE "users"
         DROP COLUMN "notify_election_reminders",
         DROP COLUMN "notify_approval_updates"`,
    );
  }
}
