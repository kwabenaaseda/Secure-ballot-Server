import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOtpCodes1787793980885 implements MigrationInterface {
  name = 'AddOtpCodes1787793980885';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" ADD "website" character varying`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD "location" character varying`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD "established_year" character varying`);
    await queryRunner.query(
      `ALTER TABLE "elections" ADD "results_status" character varying NOT NULL DEFAULT 'unreleased'`
    );
    await queryRunner.query(
      `ALTER TABLE "elections" ADD "results_released_at" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(`ALTER TABLE "elections" ADD "results_released_by" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "elections" DROP COLUMN "results_released_by"`);
    await queryRunner.query(`ALTER TABLE "elections" DROP COLUMN "results_released_at"`);
    await queryRunner.query(`ALTER TABLE "elections" DROP COLUMN "results_status"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "established_year"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "location"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "website"`);
  }
}
