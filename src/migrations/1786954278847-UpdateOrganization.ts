import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOrganization1786954278847 implements MigrationInterface {
  name = 'UpdateOrganization1786954278847';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD "status" character varying NOT NULL DEFAULT 'pending'`
    );
    await queryRunner.query(`ALTER TABLE "organizations" ADD "verification_documents" jsonb`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD "reviewed_by" uuid`);
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD "reviewed_at" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(`ALTER TABLE "organizations" ADD "rejection_reason" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "rejection_reason"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "reviewed_at"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "reviewed_by"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "verification_documents"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "status"`);
  }
}
