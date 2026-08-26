import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSystemAdmin1786952446324 implements MigrationInterface {
    name = 'CreateSystemAdmin1786952446324'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "system_admins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "username" character varying NOT NULL, "password_hash" character varying NOT NULL, "level" character varying NOT NULL DEFAULT 'admin', "status" character varying NOT NULL DEFAULT 'active', "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6fe79cd4ef7f316c0e27b025c25" UNIQUE ("email"), CONSTRAINT "UQ_092d697c4049f953d3924b971c3" UNIQUE ("username"), CONSTRAINT "PK_42deee2f0ccb3fd53df1d569ede" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "system_admins"`);
    }

}
