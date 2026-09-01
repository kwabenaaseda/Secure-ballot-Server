import { MigrationInterface, QueryRunner } from "typeorm";

export class Establishment1788277817700 implements MigrationInterface {
    name = 'Establishment1788277817700'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "established_year"`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD "established_year" smallint`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "established_year"`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD "established_year" character varying`);
    }

}
