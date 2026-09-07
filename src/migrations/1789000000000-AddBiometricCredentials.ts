import { MigrationInterface, QueryRunner } from 'typeorm';

// Tier 1.3 — WebAuthn credential storage. One row per enrolled device per user.
// Supports the step-up biometric gate on voting and account mutations.
export class AddBiometricCredentials1789000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "biometric_credentials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "credential_id" character varying NOT NULL,
        "public_key" text NOT NULL,
        "sign_count" integer NOT NULL DEFAULT 0,
        "device_name" character varying,
        "transports" character varying array NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_biometric_credential_id" UNIQUE ("credential_id"),
        CONSTRAINT "PK_biometric_credentials" PRIMARY KEY ("id"),
        CONSTRAINT "FK_biometric_credentials_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_biometric_credentials_user_id" ON "biometric_credentials" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "biometric_credentials"`);
  }
}
