import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1786586192545 implements MigrationInterface {
  name = 'InitialSchema1786586192545';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "telephone" character varying NOT NULL, "username" character varying NOT NULL, "password_hash" character varying NOT NULL, "biometric_hash" character varying, "date_of_birth" date, "nationality" character varying, "occupation" character varying, "fields_of_interest" jsonb, "profile_picture" character varying, "verification_status" character varying NOT NULL DEFAULT 'unverified', "user_status" character varying NOT NULL DEFAULT 'green', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_aacbcbfc16077f6b485951adfb4" UNIQUE ("telephone"), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "sector" character varying NOT NULL, "company_logo" character varying, "email" character varying NOT NULL, "visibility" character varying NOT NULL DEFAULT 'private', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "primary_admin_id" uuid NOT NULL, CONSTRAINT "UQ_4ad920935f4d4eb73fc58b40f72" UNIQUE ("email"), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "org_member_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "custom_data" jsonb NOT NULL, "version" integer NOT NULL DEFAULT '1', "submitted_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE, "org_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_d48bdd00d3710f6229bc190ed9d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "org_member_profile_edits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "proposed_data" jsonb NOT NULL, "reason" text, "status" character varying NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "resolved_at" TIMESTAMP WITH TIME ZONE, "org_id" uuid NOT NULL, "user_id" uuid NOT NULL, "reviewed_by" uuid, CONSTRAINT "PK_213e137345fffe87c8179338f20" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "token_blacklist" ("jti" character varying NOT NULL, "blacklisted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_73e5965ffdbd4a9f2de7c93043c" PRIMARY KEY ("jti"))`
    );
    await queryRunner.query(
      `CREATE TABLE "organization_auth" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "custom_fields" jsonb NOT NULL, "schema_version" integer NOT NULL DEFAULT '1', "status" character varying NOT NULL DEFAULT 'draft', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "org_id" uuid NOT NULL, CONSTRAINT "PK_79f0fb80cbe1f4944420a060e02" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "org_structure" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "category" character varying NOT NULL, "values" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "org_id" uuid NOT NULL, CONSTRAINT "PK_78f83709ace9524806283694426" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "org_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" character varying NOT NULL DEFAULT 'voter', "status" character varying NOT NULL DEFAULT 'pending', "verified_via" character varying, "joined_at" TIMESTAMP WITH TIME ZONE, "org_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "UQ_986db88b0e82a9189921841199b" UNIQUE ("org_id", "user_id"), CONSTRAINT "PK_8391a72b91725161ab2cab00be9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "elections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "summary" text, "field" character varying, "location" character varying, "visibility" character varying NOT NULL DEFAULT 'private', "is_public" boolean NOT NULL DEFAULT false, "scope" character varying, "icon" character varying, "status" character varying NOT NULL DEFAULT 'draft', "categories" jsonb NOT NULL DEFAULT '[]', "start_at" TIMESTAMP WITH TIME ZONE NOT NULL, "end_at" TIMESTAMP WITH TIME ZONE NOT NULL, "registration_cutoff_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "org_id" uuid NOT NULL, CONSTRAINT "PK_21abca6e4191b830d1eb8379cf0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "vote_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "voted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "election_id" uuid NOT NULL, CONSTRAINT "UQ_150cbdb0fa17df7e8541c548fb2" UNIQUE ("user_id", "election_id"), CONSTRAINT "PK_9f1ad4c240552a5ea4bdf9e2203" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "cold_store" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "election_name" character varying NOT NULL, "field" character varying, "icon" character varying, "total_votes" integer NOT NULL, "winner_per_category" jsonb, "full_results" jsonb NOT NULL, "computed_at" TIMESTAMP WITH TIME ZONE, "is_final" boolean NOT NULL DEFAULT false, "election_id" uuid NOT NULL, CONSTRAINT "PK_93d15987709434c16bdab53b265" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "candidates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullname" character varying NOT NULL, "image" character varying, "summary" text, "manifesto" text, "nationality" character varying, "category" character varying NOT NULL, "vetting_status" character varying NOT NULL DEFAULT 'pending', "vetting_score" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "election_id" uuid NOT NULL, CONSTRAINT "PK_140681296bf033ab1eb95288abb" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "vote_tallies" ("candidate_id" uuid NOT NULL, "election_id" uuid NOT NULL, "vote_count" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_e0f82291b5d13c96fe449971fbe" PRIMARY KEY ("candidate_id", "election_id"))`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_log_actor_type_enum" AS ENUM('VOTER', 'ORG_ADMIN', 'SYSTEM', 'SCHEDULER', 'KEYHOLDER', 'AUDITOR')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_log_classification_enum" AS ENUM('PUBLIC', 'INTERNAL', 'RESTRICTED', 'SEALED')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_log_integrity_class_enum" AS ENUM('STANDARD', 'SENSITIVE', 'IMMUTABLE', 'CEREMONIAL')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_log_ops_status_enum" AS ENUM('COMPLETED', 'PENDING', 'OPERATION_FAILURE', 'SYSTEM_FAILURE')`
    );
    await queryRunner.query(
      `CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "target_id" uuid, "metadata" jsonb, "event" character varying NOT NULL, "event_id" uuid NOT NULL, "source" character varying NOT NULL, "correlation_id" uuid NOT NULL, "session_id" character varying NOT NULL, "duration_ms" integer NOT NULL, "actor_type" "public"."audit_log_actor_type_enum" NOT NULL, "actor_id" character varying NOT NULL, "election_id" uuid, "org_id" uuid, "node_id" character varying NOT NULL, "region" character varying NOT NULL, "version" character varying NOT NULL, "classification" "public"."audit_log_classification_enum" NOT NULL, "integrity_class" "public"."audit_log_integrity_class_enum" NOT NULL, "threat_signals" character varying array NOT NULL, "threat_score" integer NOT NULL, "auth_factors_used" character varying array NOT NULL, "auth_confidence" double precision NOT NULL, "mfa_verified" boolean NOT NULL, "ip_hash" character varying NOT NULL, "device_fingerprint_hash" character varying, "user_agent_class" character varying NOT NULL, "sequence_number" BIGSERIAL NOT NULL, "entry_hash" character varying NOT NULL, "chain_hash" character varying NOT NULL, "signed_by" character varying NOT NULL, "signature" character varying NOT NULL, "log_segment_id" character varying NOT NULL, "success" boolean NOT NULL, "ops_status" "public"."audit_log_ops_status_enum" NOT NULL, "ops_message" character varying NOT NULL, "error_code" character varying, "error_category" character varying, "retryable" boolean, "event_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_be1cc5ca1752801131dd5321f2" ON "audit_log" ("correlation_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_15a6f5aad57db494c17986ed2e" ON "audit_log" ("actor_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2ad7930a7c2af80585c8c1b770" ON "audit_log" ("created_at") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd95c2432acabd824a92830b47" ON "audit_log" ("log_segment_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_85230f2c238c9cc15a2de65b06" ON "audit_log" ("actor_id", "event") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_53e6679fbc6d5e0f61a7e88dee" ON "audit_log" ("election_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4af781480d299e0c807f678938" ON "audit_log" ("sequence_number") `
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD CONSTRAINT "FK_20428053394ad8ddebb12905d67" FOREIGN KEY ("primary_admin_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "org_member_profiles" ADD CONSTRAINT "FK_e6ae4e3b4221c78b5e4f1fd90b5" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "org_member_profiles" ADD CONSTRAINT "FK_82c45ab3851d13a4ab510b0e875" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "org_member_profile_edits" ADD CONSTRAINT "FK_b5d65a84910fd943d402d3f2af4" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "org_member_profile_edits" ADD CONSTRAINT "FK_b574724da1eeac203b9ec59bce5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "org_member_profile_edits" ADD CONSTRAINT "FK_715c0fa3756896e7339bb0d5f73" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "token_blacklist" ADD CONSTRAINT "FK_4326ba2b08167d2edb39199a871" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_auth" ADD CONSTRAINT "FK_441d92b61dbaeb6ee502f902094" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "org_structure" ADD CONSTRAINT "FK_89447fef2de0fe81d0c9bdf06b9" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "org_members" ADD CONSTRAINT "FK_a35e7519ef33c0dd4d24bb15056" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "org_members" ADD CONSTRAINT "FK_220d854a7932f6aac9ed84f71c9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "elections" ADD CONSTRAINT "FK_2252193ab70c3450820be3df687" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "vote_records" ADD CONSTRAINT "FK_b8d50bc9b537757f3be32284a1d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "vote_records" ADD CONSTRAINT "FK_4b98ad3bce7ddfdd2e054b1df63" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "cold_store" ADD CONSTRAINT "FK_c8bf053345bb57bcff927578823" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "candidates" ADD CONSTRAINT "FK_32673ff5618c85a5ac2620e7cd0" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "vote_tallies" ADD CONSTRAINT "FK_21d9f9443913f42c86f2483342e" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "vote_tallies" ADD CONSTRAINT "FK_0ac65b4e91d55d76d683d62335a" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vote_tallies" DROP CONSTRAINT "FK_0ac65b4e91d55d76d683d62335a"`
    );
    await queryRunner.query(
      `ALTER TABLE "vote_tallies" DROP CONSTRAINT "FK_21d9f9443913f42c86f2483342e"`
    );
    await queryRunner.query(
      `ALTER TABLE "candidates" DROP CONSTRAINT "FK_32673ff5618c85a5ac2620e7cd0"`
    );
    await queryRunner.query(
      `ALTER TABLE "cold_store" DROP CONSTRAINT "FK_c8bf053345bb57bcff927578823"`
    );
    await queryRunner.query(
      `ALTER TABLE "vote_records" DROP CONSTRAINT "FK_4b98ad3bce7ddfdd2e054b1df63"`
    );
    await queryRunner.query(
      `ALTER TABLE "vote_records" DROP CONSTRAINT "FK_b8d50bc9b537757f3be32284a1d"`
    );
    await queryRunner.query(
      `ALTER TABLE "elections" DROP CONSTRAINT "FK_2252193ab70c3450820be3df687"`
    );
    await queryRunner.query(
      `ALTER TABLE "org_members" DROP CONSTRAINT "FK_220d854a7932f6aac9ed84f71c9"`
    );
    await queryRunner.query(
      `ALTER TABLE "org_members" DROP CONSTRAINT "FK_a35e7519ef33c0dd4d24bb15056"`
    );
    await queryRunner.query(
      `ALTER TABLE "org_structure" DROP CONSTRAINT "FK_89447fef2de0fe81d0c9bdf06b9"`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_auth" DROP CONSTRAINT "FK_441d92b61dbaeb6ee502f902094"`
    );
    await queryRunner.query(
      `ALTER TABLE "token_blacklist" DROP CONSTRAINT "FK_4326ba2b08167d2edb39199a871"`
    );
    await queryRunner.query(
      `ALTER TABLE "org_member_profile_edits" DROP CONSTRAINT "FK_715c0fa3756896e7339bb0d5f73"`
    );
    await queryRunner.query(
      `ALTER TABLE "org_member_profile_edits" DROP CONSTRAINT "FK_b574724da1eeac203b9ec59bce5"`
    );
    await queryRunner.query(
      `ALTER TABLE "org_member_profile_edits" DROP CONSTRAINT "FK_b5d65a84910fd943d402d3f2af4"`
    );
    await queryRunner.query(
      `ALTER TABLE "org_member_profiles" DROP CONSTRAINT "FK_82c45ab3851d13a4ab510b0e875"`
    );
    await queryRunner.query(
      `ALTER TABLE "org_member_profiles" DROP CONSTRAINT "FK_e6ae4e3b4221c78b5e4f1fd90b5"`
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP CONSTRAINT "FK_20428053394ad8ddebb12905d67"`
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_4af781480d299e0c807f678938"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_53e6679fbc6d5e0f61a7e88dee"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_85230f2c238c9cc15a2de65b06"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cd95c2432acabd824a92830b47"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2ad7930a7c2af80585c8c1b770"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_15a6f5aad57db494c17986ed2e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_be1cc5ca1752801131dd5321f2"`);
    await queryRunner.query(`DROP TABLE "audit_log"`);
    await queryRunner.query(`DROP TYPE "public"."audit_log_ops_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."audit_log_integrity_class_enum"`);
    await queryRunner.query(`DROP TYPE "public"."audit_log_classification_enum"`);
    await queryRunner.query(`DROP TYPE "public"."audit_log_actor_type_enum"`);
    await queryRunner.query(`DROP TABLE "vote_tallies"`);
    await queryRunner.query(`DROP TABLE "candidates"`);
    await queryRunner.query(`DROP TABLE "cold_store"`);
    await queryRunner.query(`DROP TABLE "vote_records"`);
    await queryRunner.query(`DROP TABLE "elections"`);
    await queryRunner.query(`DROP TABLE "org_members"`);
    await queryRunner.query(`DROP TABLE "org_structure"`);
    await queryRunner.query(`DROP TABLE "organization_auth"`);
    await queryRunner.query(`DROP TABLE "token_blacklist"`);
    await queryRunner.query(`DROP TABLE "org_member_profile_edits"`);
    await queryRunner.query(`DROP TABLE "org_member_profiles"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
