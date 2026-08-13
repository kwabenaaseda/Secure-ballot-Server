import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRolePermissions1786589092704 implements MigrationInterface {
    name = 'AddRolePermissions1786589092704'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "role_permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" character varying NOT NULL, "resource" character varying NOT NULL, "action" character varying NOT NULL, "effect" character varying NOT NULL DEFAULT 'ALLOW', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4166f297d8de3541d5a5e9c01e6" UNIQUE ("role", "resource", "action"), CONSTRAINT "PK_84059017c90bfcb701b8fa42297" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "role_permissions"`);
    }

}
