import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOtpCodesTable1787794656795 implements MigrationInterface {
  name = 'CreateOtpCodesTable1787794656795';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "otp_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_identifier" character varying NOT NULL, "code_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9d0487965ac1837d57fec4d6a26" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_565f3fdb455d829f0975faafa7" ON "otp_codes" ("user_identifier") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_565f3fdb455d829f0975faafa7"`);
    await queryRunner.query(`DROP TABLE "otp_codes"`);
  }
}
