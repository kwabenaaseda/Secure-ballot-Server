import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemAdminToAuditActorType1789300000000 implements MigrationInterface {
  name = 'AddSystemAdminToAuditActorType1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add SYSTEM_ADMIN to the audit_log_actor_type_enum
    // This value is used by admin OTP verification and other admin operations
    await queryRunner.query(
      `ALTER TYPE "public"."audit_log_actor_type_enum" ADD VALUE IF NOT EXISTS 'SYSTEM_ADMIN'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing values from an enum type directly.
    // This migration is intentionally not reversible without recreating the enum.
    // To rollback, you would need to:
    // 1. Create a new enum without SYSTEM_ADMIN
    // 2. Alter the column to use the new enum
    // 3. Drop the old enum
    console.warn(
      'Rollback of AddSystemAdminToAuditActorType is not supported. PostgreSQL does not allow removing enum values.'
    );
  }
}
