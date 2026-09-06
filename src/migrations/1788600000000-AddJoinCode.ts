import { MigrationInterface, QueryRunner } from "typeorm";

export class AddJoinCode1788600000000 implements MigrationInterface {
    name = 'AddJoinCode1788600000000'

        public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "join_code" character varying(12)`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "join_code"`);
    }

}