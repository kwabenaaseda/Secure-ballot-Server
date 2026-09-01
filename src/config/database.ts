// TypeOrm Setup
import dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { ENV, VALIDATE_ENV } from '../workers/env_validator.ts';
import { Candidate } from '../entities/Candidates.ts';
import { Election } from '../entities/Election.ts';
import { AuditLog } from '../entities/audit_log.ts';
import { ColdStore } from '../entities/cold_store.ts';
import { OrganizationAuth } from '../entities/Org_auth.ts';
import { OrgStructure } from '../entities/Org_structure.ts';
import { Organization } from '../entities/Organization.ts';
import { OrgMemberProfiles } from '../entities/OrgMember_profile.ts';
import { OrgMemberProfileEdits } from '../entities/OrgMember_profileEdit.ts';
import { OrgMembers } from '../entities/OrgMembers.ts';
import { RolePermission } from '../entities/RolePermission.ts';
import { SystemAdmin } from '../entities/SystemAdmin.ts';
import { TokenBlacklist } from '../entities/token_blacklist.ts';
import { User } from '../entities/User.ts';
import { VoteRecord } from '../entities/Vote_record.ts';
import { VoteTally } from '../entities/Vote_tally.ts';
import { OtpCode } from '../entities/OtpCode.ts';
VALIDATE_ENV();

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(ENV('DATABASE_URL') !== 'false'
    ? {
        url: ENV('DATABASE_URL'),
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        host: ENV('DATABASE_HOST') || '127.0.0.1',
        port: parseInt(ENV('DATABASE_PORT') || '5432', 10),
        username: ENV('DATABASE_USERNAME') || 'secureballot_user',
        password: ENV('DATABASE_PASSWORD') || 'secureballot_secure_pass',
        database: ENV('DATABASE_NAME') || 'secureballot_dev',
      }),
  synchronize: false, // Set to false in production, true for development
  migrationsRun: false, // Set to true if you want migrations to run automatically on app start
  logging: false,
  entities: [
    Candidate,
    Election,
    AuditLog,
    ColdStore,
    OrganizationAuth,
    OrgStructure,
    Organization,
    OrgMemberProfiles,
    OrgMemberProfileEdits,
    OrgMembers,
    RolePermission,
    SystemAdmin,
    TokenBlacklist,
    User,
    VoteRecord,
    VoteTally,
    OtpCode,
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});

export const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
};
