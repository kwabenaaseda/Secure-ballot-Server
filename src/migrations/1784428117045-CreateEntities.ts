import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEntities1784428117045 implements MigrationInterface {
    name = 'CreateEntities1784428117045'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_log" ALTER COLUMN "device_fingerprint_hash" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_log" ALTER COLUMN "device_fingerprint_hash" SET NOT NULL`);
    }

}
