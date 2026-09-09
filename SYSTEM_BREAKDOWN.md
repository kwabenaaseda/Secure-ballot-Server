# SecureBallot Server — System Breakdown

A detailed technical map of the SecureBallot backend: every service, the runtime
tool chain, the request/auth flow, and the data model.

- **Runtime:** Bun (`>=1.0.0`), TypeScript, Express 4
- **ORM:** TypeORM (`0.3.17`) over PostgreSQL 16 (via `pg`)
- **Auth:** JWT (access + rotated refresh tokens, blacklist revocation), bcrypt
  password hashing, WebAuthn (biometric login, `@simplewebauthn/server`),
  one-time passcodes (email + SMS OTP)
- **Messaging:** Brevo (email), Vonage (SMS/WhatsApp), Nodemailer (fallback),
  Resend scaffold, Bull job-queue UI (optional profile)
- **Docs:** Swagger UI mounted at `/api/docs`

---

## 1. Runtime & Tool Chain

### 1.1 Execution stack
| Layer | Technology |
| --- | --- |
| Language | TypeScript 5.3, built/run by **Bun** |
| Web framework | Express 4.18 (`express`, `express-async-errors`) |
| HTTP security | `helmet`, `cors`, `express-rate-limit` |
| ORM / DB | TypeORM 0.3.17 → `pg` → PostgreSQL 16 |
| Tokens | `jsonwebtoken` (JWT), `bcrypt` |
| Validation | `zod` (in service payloads) |
| IDs | `uuid` (v9) |
| Swagger | `swagger-jsdoc` + `swagger-ui-express` |

### 1.2 Scripts (`package.json`)
| Command | Purpose |
| --- | --- |
| `bun dev` | Hot-reload dev server (`src/server.ts`) |
| `bun run build` | Compile to `dist/server.js` (Bun build) |
| `bun start` | Run the built server |
| `bun run type-check` | `tsc --noEmit` whole-project type gate |
| `bun run lint` / `format` | ESLint / Prettier |
| `bun test` | `bun test` test runner |
| `bun run migration:run` | Run TypeORM migrations |
| `bun run migration:generate` | Scaffold a new migration |
| `bun run seed:permissions` | Load the permission matrix |
| `bun run seed:superadmin` | Bootstrap the first `super_admin` |
| `bun run db:nuke` | Wipe dev data |

### 1.3 Process boot sequence (`src/server.ts`, `src/app.ts`)
1. `dotenv.config()` loads `.env`.
2. `VALIDATE_ENV()` fails fast on missing critical config.
3. `initializeDatabase()` creates the TypeORM DataSource and connects
   (pooled connection — see §1.4).
4. `LoadPermissionCache()` populates the in-memory RBAC matrix.
5. Express app starts, applies middleware in order:
   `express.json` → `helmet` → `cors` → Swagger → `apiLimiter` → route router
   → 404 fallback → terminal error handler.
6. `app.listen(PORT)` binds; startup success is logged.

### 1.4 Performance & connection pooling (`src/config/database.ts`)
The DataSource config now enables a **connection pool** (extras): warm
PostgreSQL connections are reused across requests instead of reconnecting per
query — the single biggest hosted-load improvement. Tunable via env vars:

| Env | Default | Meaning |
| --- | --- | --- |
| `DB_POOL_MAX` | `10` | Max pooled connections |
| `DB_POOL_MIN` | `1` | Min idle connections |
| `DB_POOL_IDLE_TIMEOUT` | `30000` | Close idle conn after (ms) |
| `DB_POOL_CONNECT_TIMEOUT` | `10000` | Per-connection connect timeout (ms) |
| `DB_POOL_ACQUIRE_TIMEOUT` | `10000` | Wait for a slot before failing (ms) |

`ssl.rejectUnauthorized=false` keeps managed-host TLS connections working.
`synchronize=false` and `migrationsRun=false` — schema is migration-managed.

### 1.5 Admin authorization cache (`src/middleware/require.system.admin.ts`)
System-admin request authorization now uses a **30-second in-memory TTL cache**
over the `system_admins` table. Previously every admin request made 2–3
sequential DB lookups (`Operations_Manager` → user profile + admin lookup, then
another admin lookup). Now each admin request is at most **1** indexed lookup,
and typically **0** for a warm cache. Suspension/level changes propagate within
30 s (tunable via `ADMIN_CACHE_TTL_MS`). Both intents (SystemAdmin / SuperAdmin)
---

## 2. Authentication & Authorization Flows

### 2.1 Core middleware chain
- **`NetworkContextMiddleware`** (`src/middleware/networkContext.ts`) — attaches
  `req.networkContext` (IP hash, device fingerprint, UA class, correlation id,
  session id) used for audit + threat scoring.
- **`AuthMiddleware`** (`src/middleware/auth.middleware.ts`) — extracts the
  `Bearer` token, verifies it, enforces the checksum fields, checks the
  `token_blacklist` (revocation, one indexed PK lookup when `jti` present),
  attaches `req.user`, and re-resolves the caller's platform role
  (`resolved_role`) from the DB via `Operations_Manager` so token-role drift is
  visible. Org-scoped role (`resolved_org_role`) is resolved when `:orgId` is
  present.
- **`RequireSystemAdmin` / `RequireSuperAdmin`** — see §1.5; enforce admin
  access with the cache.

### 2.2 Authorization model (`src/utils/ops.manager.ts`)
Two deliberate layers:
1. **Role tier (PDP/PEP, default-deny)** — `Operations_Manager` resolves a
   `user_profiler` (verification/account status, org role/status) and returns a
   `ROLES` value (`NO_ACCESS`, `ACCOUNT_ACCESS[PART|FULL]`,
   `VOTER_ACCESS_PASS[PART|FULL]`, `ORG_ACCESS[PART|FULL]`, `SYSTEM_ADMIN`).
   `Authorize(role, resource, action)` consults the DB-loaded
   `PERMISSION_CACHE` (fail-closed when empty).
2. **Row-level checks** — each election/org/vote service independently verifies
   ownership + object state against specific DB rows. The JWT `range` claim is
   never trusted for authorization; the DB is the source of truth.

### 2.3 User (voter) auth flows
**Signup → verify:**
```
POST /auth/user/signup      (create user, hash password)
POST /auth/user/login       (verify password → generate OTP → email + SMS)
POST /auth/user/verify-otp  (verify OTP → promote to verified → mint tokens)
POST /auth/user/resend-otp  (re-email a fresh code)
```
Login is **password + OTP**.

**Password recovery:**
```
POST /auth/user/forgot-password      (find user → generate OTP → email)
POST /auth/user/verify-recovery-otp  (verify → issue a reset capability)
POST /auth/user/reset-password       (set new password)
```

**Session management:**
- `POST /auth/user/refresh` — rotate refresh token (old jti blacklisted).
- `POST /auth/user/logout` — blacklist the presented access token's jti.
- `POST /auth/user/biometric/login/start|finish` — WebAuthn login.

### 2.4 System admin auth flows **(MFA now enabled)**
The previous single-step, password-only admin login is now a **two-step ladder**:

```
STEP 1  POST /auth/admin/login        email + password
        └─ verify credentials → generate OTP → email it
        └─ respond { mfa_required: true, admin: { id, ... } }   (NO tokens yet)

STEP 2  POST /auth/admin/verify-otp   adminId + otp
        └─ verify OTP (hash-checked, single-use, 10-min TTL)
        └─ mint access token (range SYSTEM_ADMIN, data.admin = level)
        └─ mint refresh token
        └─ respond { token, refresh_token, admin }

Assist  POST /auth/admin/resend-otp   adminId → generate + email a new code
```

- `POST /auth/admin/onboard` — super_admin creates another admin; a temp
  password is generated and returned once.
- `POST /auth/admin/logout` — blacklist the admin access token.

Admin tokens are signed with `range=SYSTEM_ADMIN`, `verification=verified`,
`user_status=green`, and `data: { admin: <level> }`; `RequireSuperAdmin` reads
the admin's level from the cached DB row.

### 2.5 Token utility (`src/utils/auth.ts`)
- `GenerateToken` — JWT signed with `JWT_SECRET`, `jti` = `randomUUID()`;
  expiry is role-dependent (`JWT_EXPIRATION` default `24h` for full/system
  roles, `8m` for PART/VOTER roles, `5m` fallback).
- `VerifyToken` — `jwt.verify(..., { ignoreExpiration: false })`.
- `Generate_Refresh_Token` — refresh JWT (`JWT_REFRESH_EXPIRATION` default
  `48h`), also with a `jti` for rotation/revocation.
- `Hash_Password` / `Verify_Hash` — bcrypt (cost 10).

### 2.6 OTP utility (`src/utils/otp.ts`)
- 5-character codes from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (crypto-random).
- **`generateOTP(identifier)`** deletes any previous code for that identifier,
  stores a SHA-256 hash + 10-minute expiry.
- **`verifyOTP(identifier, code)`** — SHA-256 hashes input, compares with
  `timingSafeEqual`, **consumes the code on success** (single-use), deletes on
  expiry.
- Delivery: `sendOTPEmail` (Brevo) and/or `sendOTPSMS` (Vonage).

---
fail closed on any query error.

---

## 3. Service-by-Service Breakdown

Every operation is implemented as a **service** returning a standard
`Service_Success_Handler | Service_Error_Handler` envelope. Controllers are thin
HTTP adapters; routes bind controllers. The OPS wrapper
(`src/lib/ops/ops.factory.ts`) builds the metadata block, a security block, a
hash-chained integrity proof, and **non-blocking** writes to the `audit_log`.

### 3.1 Administration (`src/services/admin_management/`)
| Service | Operation | Notes |
| --- | --- | --- |
| `ListUsers_Operation` | `ADMIN_LIST_USERS` | Paginated-ish (take 100), optional `verification_status` filter, DESC by `created_at`. |
| `SetUserStatus_Operation` | `ADMIN_SET_USER_STATUS` | Transactional update of a user's account status (green/yellow/red). |
| `ListOrganizations_Operation` | `ADMIN_LIST_ORGS` | **Paginated** (`findAndCount`) — `limit`/`offset` query params, DESC by `created_at`; returns `{ organizations, count, total, limit, offset }`. |
| `ListAuditLogs_Operation` | `ADMIN_LIST_AUDIT_LOGS` | Paginated audit log query, filters: `actor_type`, `event`, `success`. |
| `GetAuditLogStats_Operation` | `ADMIN_AUDIT_LOG_STATS` | Aggregates: totals, success rate, actor/event breakdowns, avg threat score. |
| `Approve/Reject/SuspendOrganization_Operation` | admin org moderation | State transitions on `organizations.status`. |

**Admin routes** (`/admin/*`, all behind `AuthMiddleware` + `RequireSystemAdmin`):
`GET /users`, `PATCH /users/:id/status`, `GET /organizations`,
`PATCH /organizations/:id/approve|reject|suspend`, `POST /permissions/reload`,
`GET /audit-logs`, `GET /audit-logs/stats`.

### 3.2 User account services (`src/services/account/`, `src/services/auth_mod_sys_users/`)
| Service | Purpose |
| --- | --- |
| `GetSelf_Operation` | Current user profile. |
| `GetDashboard_Operation` | Account dashboard aggregates. |
| `UpdateSelf_Operation` | Update profile fields. |
| `DeleteSelf_Operation` | Self-delete. |
| `RequestMutationOTP_Operation` / `VerifyMutationOTP_Operation` | Step-up OTP for account mutation. |
| `Login_Operation` | Password check → OTP dispatch (email + SMS). |
| `VerifyAccount_Operation` | OTP verify → promote verification → reissue tokens. |
| `ResendOTP_Operation` | Fresh code. |
| `Signup_Operation` | Create user, hash password, send welcome + OTP. |
| Recovery trio | `ForgotPassword`, `ResetVerifyOTP`, `ResetPassword`. |

### 3.3 Organization services (`src/services/organization*`, `src/services/organization_management/`)
| Service | Purpose |
| --- | --- |
| `CreateOrganization_Operation` | Create org + creator membership (txn). |
| `GetOrgDetail` / `Search` | Public-ish org lookup/search. |
| `OpenSession` / `Join` / `VerifyCode` | Join flow (passphrase / invite). |
| `DeleteOrganization_Operation` | Cascade delete org. |
| `MemberManagement` | List members, update role/status. |
| `ApproveJoin` | Approve/deny pending join requests. |
| `UploadRoster` / `GetRosterSummary` | Bulk member import via `org_rosters`. |

**Org routes** (`/org/*`): `POST /create`, `GET /search`, `GET /:orgId`,
`DELETE /:orgId`, `POST /:orgId/verify-code|open|join`, `GET /:orgId/members`,
`PATCH /:orgId/members/:memberId/role|status`, `GET /:orgId/join-requests`,
`POST /:orgId/join-requests/:memberId/approve|deny`, `GET|POST /:orgId/roster`.

### 3.4 Election services (`src/services/Election_management/`)
`CreateElection`, `AddCandidate`, `ListElections`, `GetElection`,
`PublishElection`, `CloseElection`, `ReleaseResults`, `ExportResults`,
`GetResults`. Helper: `election.status.ts` (state machine transitions).
Route base `/election`.

### 3.5 Voting services (`src/services/Voting_service/`)
`CastVote` — records a `VoteRecord`, tallies into `VoteTally`. Only
`POST /vote/cast` (`AuthMiddleware` + `NetworkContextMiddleware`).

### 3.6 Biometric (WebAuthn) services (`src/services/biometric/`)
`RegisterStart/Finish`, `AuthenticateStart/Finish`, `LoginStart/Finish`,
`VerifyStepUp`. Backed by `biometric_credentials` (credential id, COSE public
key, sign counter, transports). Routes under `/biometric`.

### 3.7 Notifications (`src/services/notifications/`, worker `src/workers/`)
In-process notification sends (see the no-op `worker` script comment — there is
no standalone Bull worker; sends happen inside the request path). Routes:
`GET /`, `PATCH /:id/read`, `POST /read-all`, `PATCH /preferences`.

### 3.8 Auth helpers (`src/services/auth/`)
`Logout` (blacklist jti) and `Refresh` (rotate refresh token). Both shared by
admin and user routers.

---
---

## 4. Data Model (Entities)

Registered in `src/config/database.ts` (TypeORM, table `organizations` etc.):

| Entity | Table / Purpose |
| --- | --- |
| `User` | Voter accounts: credentials, `verification_status`, `user_status`. |
| `SystemAdmin` | Isolated system-admin table (`system_admins`): `level` admin/super_admin, `status`. |
| `Organization` | Tenant: name, sector, email, visibility, `status` (pending/active/suspended/rejected), join_code, docs, `created_by`/`reviewed_*`. |
| `Org_auth` | Organization auth context. |
| `OrgMembers` | Membership rows (voter/admin/moderator, `verified_via`, status). |
| `OrgMember_profile` | Extended member profile. |
| `OrgRoster` | Bulk-imported membership roster. |
| `Election` | Election definition + lifecycle state. |
| `Candidates` | Candidate rows per election. |
| `VoteTally` | Aggregated tally per election. |
| `Vote_record` | Individual cast votes. |
| `cold_store` | Cold storage for verifiable records. |
| `BiometricCredential` | WebAuthn credentials per user. |
| `OtpCode` | Hashed one-time codes (`user_identifier`, `code_hash`, `expires_at`). |
| `token_blacklist` | Revoked token `jti`s (token range + expiry). |
| `RolePermission` | RBAC matrix (role/resource/action → effect). |
| `audit_log` | Hash-chained operational audit trail (threat scoring fields). |
| `Notification` | System + per-user notifications. |

**Integrity / audit pipeline** (`src/lib/ops/helpers/`): `build.meta.ts`,
`build.security.ts`, `build.integrity.ts`, `compute.threat.ts`,
`write.audit.ts`. Every OPS success/error is integrity-proofed and written
**asynchronously** so database slowness never delays the HTTP response.

---

## 5. Messaging Providers (`src/workers/`)
| Worker | Provider | Methods |
| --- | --- | --- |
| `email.service.ts` | Brevo (`brevo.service.ts`) | `sendWelcomeEmail`, `sendOTPEmail`, `sendPasswordResetEmail`, `sendAccountRecoveryEmail`. |
| `messenger.service.ts` | Vonage (SMS/WhatsApp) | `sendSMS`, `sendOTPSMS`, `sendWhatsApp`, `sendOTPWhatsApp`. Falls back to mock-log when unconfigured. |
| `nodemailer.service.ts` | Nodemailer (SMTP) | Legacy/fallback transport. |
| `resend` (pkg) | Resend | Alternative email provider scaffold. |
| `env_validator.ts` | — | `ENV(key)` + `VALIDATE_ENV()` fail-fast config guard. |

---

## 6. Environment Variables (reference)
Runtime requires: `DATABASE_URL` (or `DATABASE_*`), `JWT_SECRET`,
`JWT_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `PORT`, `NODE_ENV`, `CORS_ORIGIN`.
Optional providers/settings: `BREVO_API_KEY` `BREVO_URL` `MAIL_FROM`
`MAIL_FROM_NAME`, `VONAGE_API_KEY` `VONAGE_API_SECRET` `VONAGE_WHATSAPP_*`,
`SMTP_*`, `REDIS_*`, `API_URL`, `LOG_LEVEL`, `DB_POOL_*` (see §1.4).

---

## 7. Endpoint Summary (by route mount)
| Base | Auth | Endpoints |
| --- | --- | --- |
| `/auth/user` | mixed | signup, login, biometric/login/start+finish, verify-otp, logout, resend-otp, forgot-password, verify-recovery-otp, reset-password, refresh |
| `/auth/admin` | public+gate | **login, verify-otp, resend-otp** (public), onboard (super_admin), logout |
| `/admin` | +RequireSystemAdmin | users, users/:id/status, organizations, organizations/:id/approve/reject/suspend, permissions/reload, audit-logs, audit-logs/stats |
| `/org` | +AuthMiddleware | create, search, :orgId, :orgId/verify-code|open|join, members*, join-requests*, roster |
| `/election` | +AuthMiddleware | create, :orgId list, :electionId, publish, close, release-results, results, results/export |
| `/vote` | +AuthMiddleware | cast |
| `/biometric` | — | register/start+finish, authenticate/start+finish, devices |
| `/notifications` | — | list, :id/read, read-all, preferences |
| `/account/settings` | +AuthMiddleware | self, request-mutation-otp, verify-mutation-otp, patch, delete |
| `/account` | +AuthMiddleware | dashboard |
| `/api/docs` | — | Swagger UI |

---

*Generated from the SecureBallot `main` branch service map. Update this file
alongside any route/service/data-model change.*
---