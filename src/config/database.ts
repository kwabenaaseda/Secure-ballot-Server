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
import { Organization } from '../entities/Organization.ts';
import { OrgMemberProfiles } from '../entities/OrgMember_profile.ts';
import { OrgMembers } from '../entities/OrgMembers.ts';
import { RolePermission } from '../entities/RolePermission.ts';
import { SystemAdmin } from '../entities/SystemAdmin.ts';
import { TokenBlacklist } from '../entities/token_blacklist.ts';
import { User } from '../entities/User.ts';
import { VoteRecord } from '../entities/Vote_record.ts';
import { VoteTally } from '../entities/Vote_tally.ts';
import { BiometricCredential } from '../entities/BiometricCredential.ts';
import { Notification } from '../entities/Notification.ts';
import { OrgRoster } from '../entities/OrgRoster.ts';

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
  // ── Connection pool ─────────────────────────────────────────────────────
  // Reuses warm PostgreSQL connections instead of opening a new one per
  // query. This is the single biggest hosted-load-time win for a TypeORM app:
  // TLS handshakes and new socket setup are expensive on cold connections.
  // Tune `max` to the platform's connection limit (Bun's default stack will
  // keep up; most managed Postgres plans allow 5-25 concurrent connections
  // per app instance — 10 is a safe default).
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    min: parseInt(process.env.DB_POOL_MIN || '1', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECT_TIMEOUT || '10000', 10),
    // If the pool is exhausted, wait (don't drop) up to acquireTimeoutMillis
    // for a slot to free up.
    acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '10000', 10),
  },
  entities: [
    Candidate,
    Election,
    AuditLog,
    ColdStore,
    OrganizationAuth,
    Organization,
    OrgMemberProfiles,
    OrgMembers,
    RolePermission,
    SystemAdmin,
    TokenBlacklist,
    User,
    VoteRecord,
    VoteTally,
    OtpCode,
    BiometricCredential,
    Notification,
    OrgRoster,
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
