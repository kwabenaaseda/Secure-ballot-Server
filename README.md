# SecureBallot

**Anonymous, multi-tenant electronic voting — backend + web client.**

SecureBallot is **election infrastructure for membership organizations** — unions, student bodies, cooperatives, professional associations — that need real ballot secrecy and legitimate-member verification, but don't have the budget, expertise, or stakes level that would justify cryptographic end-to-end-verifiable voting. Its core guarantee: **your ballot is secret, your participation is verifiable.** The backend is a Bun + Express service backed by PostgreSQL and Redis, with a custom *OPS* layer that wraps every request in a hash-chained, signed audit envelope. The frontend is a React + Tailwind + Vite single-page app that consumes a single typed API.

**What it is not:** it is not a government-election system (no cryptographic end-to-end verifiability or legal chain of custody), and not shareholder voting (votes are strictly one-member-one-vote — there is no weighting mechanism). Eligibility is handled per-organization via **BYOI custom join fields** (membership numbers, student IDs, etc.) plus system-admin approval of organizations, which fits federated membership bodies rather than national electorates.

> This is the project-level README for the monorepo. See `Secure-ballot-Server/` for backend details and `Secure-ballot-Client/` for the web client.

---

## Table of contents

- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Architecture (server)](#architecture-server)
- [API reference](#api-reference)
- [Client](#client)
- [Database](#database)
- [Setup & installation](#setup--installation)
- [Scripts](#scripts)
- [Security model](#security-model)
- [Status & roadmap](#status--roadmap)
- [Notes](#notes)

---

## Project structure

```
SecureBallot/
├── Secure-ballot-Server/      # Bun + Express API
│   ├── src/
│   │   ├── server.ts          # Entry point (bootstrap)
│   │   ├── app.ts             # Express app (middleware, routes, error handler)
│   │   ├── config/            # database.ts, server.settings.ts, swagger.ts
│   │   ├── routes/            # Route modules + routes.ts aggregator
│   │   ├── controllers/       # Thin controllers (validate -> service -> envelope)
│   │   ├── services/          # Business logic (each emits OPS results)
│   │   ├── entities/          # 15 TypeORM entities
│   │   ├── migrations/        # 9 sequential migrations
│   │   ├── middleware/        # auth, rateLimit, require.system.admin, networkContext
│   │   ├── lib/ops/           # Custom OPS audit/integrity layer
│   │   ├── workers/           # Email/SMS providers + env validator
│   │   ├── utils/             # Logger, auth (JWT/bcrypt), ops.manager, otp
│   │   ├── scripts/           # seed-permissions, seed-super-admin, generate-migration
│   │   └── types/             # Response_handler types
│   ├── .env                   # Environment config
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── package.json
│
└── Secure-ballot-Client/      # React + Vite SPA
    ├── src/
    │   ├── main.tsx           # React entry
    │   ├── App.tsx            # Router + auth gates
    │   ├── index.css          # Tailwind + design tokens
    │   ├── context/           # AuthContext, AdminAuthContext, ThemeContext
    │   ├── layouts/           # AppLayout, AuthLayout, AdminLayout
    │   ├── pages/             # Route pages (auth, dashboard, orgs, elections, admin)
    │   ├── components/        # UI kit (Badge, Button, Card, Input, dialogs)
    │   ├── lib/api.ts         # Typed API client
    │   ├── hooks/             # useBiometricEnrollment
    │   └── data/mockData.ts   # Offline mock data
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    └── package.json
```

---

## Tech stack

| Layer | Technology |
|---|---|
| **Server runtime** | Bun (>= 1.0) |
| **HTTP framework** | Express 4 |
| **ORM / DB** | TypeORM + PostgreSQL 16 |
| **Cache / queue** | Redis 7 |
| **Auth** | JWT (access + refresh), bcrypt |
| **Validation** | Zod |
| **API docs** | Swagger UI (`/api/docs`) |
| **Client** | React 18 + TypeScript + Vite 5 |
| **Styling** | Tailwind CSS 3 (light/dark, design tokens) |
| **Routing** | React Router 7 |
| **Icons** | lucide-react |

---

## Architecture (server)

### Entry & bootstrap

`src/server.ts` is the entry point. On startup it:

1. Loads `.env` via `dotenv`.
2. Runs `VALIDATE_ENV()` -- fails fast if any required env var is missing.
3. Initializes the TypeORM `DataSource` (`initializeDatabase`).
4. Loads the role-permission matrix into an in-memory cache (`LoadPermissionCache`).
5. Starts the Express server.

`src/app.ts` wires the Express app: `helmet` (security headers, CSP disabled for Swagger), CORS (allow-list from `CORS_ORIGIN`), JSON parsing, Swagger UI at `/api/docs`, all routes under `/api/vx` behind a global rate limiter, a 404 fallback, and a terminal error handler that never leaks a stack trace to the client.

### The OPS system

Every service operation emits its result through the custom **OPS layer** (`src/lib/ops/`). This is not a logging framework -- it is the response factory. `OPS_Success` and `OPS_Error` build a uniform envelope containing:

- `_OPS_META` -- event id, correlation id, session id, timestamp, duration, actor, source.
- `_OPS_SECURITY` -- classification, integrity class, threat signals/score, auth factors, hashed IP/device.
- `_OPS_INTEGRITY` -- `entry_hash`, `chain_hash` (SHA-3 over entry + previous chain hash), server signature, sequence number.
- `_OPS_DATA` / `_OPS_ERROR` -- the payload, or a structured error (`code`, `category`, `retryable`, `retry_after_ms`).

The result is written non-blocking to the append-only `audit_log` table, forming a hash-chained, signed audit trail. A missing entry is detectable after the fact.

### Response envelope

Every endpoint returns the same shape. Controllers strip it to a client-friendly form:

```ts
// Success
{ success: true,  message: string, data?: object }

// Error
{ success: false, message: string, errors?: FieldErrors }
```

The full OPS envelope is preserved in the audit log and available for verification.

### Authentication & authorization

Two deliberate layers (fail-closed, default-deny):

1. **Role-tier gate** -- a static `role -> resource -> action` matrix stored in `role_permissions`, loaded into memory at boot (`ops.manager.ts`). `Authorize()` checks it. A missing row and an explicit DENY both resolve to *deny*.
2. **Inline row-level checks** -- ownership, election state, org suspension, membership status. These cannot be expressed as static triples and are enforced inside services.

The JWT's `range` claim is **never** trusted for authorization -- the database is the source of truth.

### Token ladder

Access tokens carry a `range` that encodes what the holder may do. The ladder:

| Token range | When issued | What it allows |
|---|---|---|
| `ACCOUNT_ACCESS[PART]` | After signup/login (pre-OTP) | Read-only: explore, search orgs. No voting, no account writes. |
| `ACCOUNT_ACCESS[FULL]` | After OTP verification | Read + create orgs, apply to join, view account. |
| `VOTER_ACCESS_PASS[PART]` | Admitted to an election | View that election, fill ballot, see certified results. |
| `VOTER_ACCESS_PASS[FULL]` | At vote-casting time | Cast a vote. |
| `ORG_ACCESS[PART]` | Org admin (green status) | Create/publish elections, verify join requests, delete own org. |
| `ORG_ACCESS[FULL]` | Org owner/moderator | All admin actions + update election metadata. |
| `SYSTEM_ADMIN` | System admin login | Platform oversight (user/org management). |
| `NO_ACCESS` | Flagged account | Account recovery only. |

- **User auth** is password + OTP. Signup/login return a short-lived **PART** token; `/verify-otp` exchanges it for a **FULL** token + refresh token.
- **Admin auth** is password-only (no OTP) -- an explicitly accepted risk documented in the route file, mitigated by a separate `system_admins` table, per-action authorization, and a revocable token.
- **Account mutations** (update/delete) require step-up auth: request a mutation OTP, verify, then use the short-lived mutation token.
- **Password reset**: forgot-password, verify-recovery-otp (returns a short-lived token), reset-password.
- **Token revocation**: logout inserts the token's `jti` into `token_blacklist`; refresh rotates tokens (old `jti` blacklisted).


---

## API reference

Base URL: `/api/vx` (e.g. `http://localhost:3000/api/vx`). Interactive docs: **`/api/docs`** (Swagger UI).

Auth: send `Authorization: Bearer <token>`. PART tokens only work for the OTP step; most endpoints require a FULL token.

### Auth -- User (`/auth/user`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | -- | Create account -> PART token + OTP sent |
| POST | `/login` | -- | Authenticate -> PART token + OTP sent |
| POST | `/verify-otp` | PART | Verify OTP -> FULL token + refresh token |
| POST | `/logout` | user | Revoke current token |
| POST | `/resend-otp` | PART | Resend OTP |
| POST | `/forgot-password` | -- | Request reset (returns `user_id`) |
| POST | `/verify-recovery-otp` | -- | Verify reset OTP -> short-lived token |
| POST | `/reset-password` | user | Set new password |
| POST | `/refresh` | -- | Rotate refresh token -> fresh pair |

### Auth -- Admin (`/auth/admin`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/login` | -- | System admin login -> FULL token |
| POST | `/logout` | admin | Revoke token |
| POST | `/onboard` | super_admin | Create a new admin |

### Admin (`/admin`) -- system_admin required

| Method | Path | Description |
|---|---|---|
| GET | `/users` | List users (filter by `verification_status`) |
| PATCH | `/users/:id/status` | Set user status (green/yellow/red) |
| GET | `/organizations` | List all organizations |
| PATCH | `/organizations/:id/approve` | Approve pending org |
| PATCH | `/organizations/:id/reject` | Reject org (reason required) |
| PATCH | `/organizations/:id/suspend` | Suspend active org (reason required) |

### Organizations (`/org`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/create` | user | Create org |
| GET | `/search` | user | Search verified orgs |
| GET | `/:orgId` | user | Org detail |
| DELETE | `/:orgId` | user | Delete org |
| POST | `/:orgId/verify-code` | user | Verify join passcode |
| POST | `/:orgId/join` | user | Request to join |
| GET | `/:orgId/members` | user | List members |
| PATCH | `/:orgId/members/:memberId/role` | user | Set member role |
| PATCH | `/:orgId/members/:memberId/status` | user | Activate/deactivate member |
| GET | `/:orgId/join-requests` | user | List pending join requests |
| POST | `/:orgId/join-requests/:memberId/approve` | user | Approve join request |
| POST | `/:orgId/join-requests/:memberId/deny` | user | Deny join request |

### Elections (`/election`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/create` | user | Create election (draft) |
| POST | `/candidate` | user | Add candidate to draft |
| GET | `/org/:orgId` | user | List org's elections |
| GET | `/:electionId` | user | Election detail + candidates + `has_voted` |
| POST | `/:electionId/publish` | user | Draft -> published |
| POST | `/:electionId/close` | user | Published -> closed |
| GET | `/:electionId/results` | user | Aggregated tallies |
| POST | `/:electionId/release-results` | user | Release results to voters |
| GET | `/:electionId/results/export` | user | CSV export |

### Voting (`/vote`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/cast` | user | Cast a vote |

### Account (`/account`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/settings` | user | Get profile |
| POST | `/settings/request-mutation-otp` | user | Step-up: request mutation OTP |
| POST | `/settings/verify-mutation-otp` | user | Step-up: verify -> mutation token |
| PATCH | `/settings` | mutation token | Update profile |
| DELETE | `/settings` | mutation token | Delete account |
| GET | `/dashboard` | user | User dashboard (orgs + elections) |


---

## Client

A React 18 + TypeScript + Vite 5 SPA. Styling uses Tailwind 3 with a token-driven design system (`index.css`) supporting light/dark themes and a full typography/spacing/radius scale.

### Routing

`App.tsx` defines routes as data arrays, each wrapped by an auth gate:

- **Open** -- `/`, `/internal/admin/login`.
- **Auth flow** -- `/login`, `/signup`, `/verify-otp`, `/forgot-password`, `/reset-password` (redirect signed-in users to dashboard).
- **App** (user JWT) -- `/dashboard`, `/settings`, `/organizations`, `/organizations/new`, `/organizations/:id`, `/organizations/:id/join`, `/organizations/:id/pending`, `/organizations/:id/admin`, `/organizations/:id/elections/new`, `/elections/:electionId`, `/elections/:electionId/vote`.
- **Admin** (admin JWT) -- `/internal/admin/dashboard`, `/users`, `/organizations`, `/onboard`.
- **Fallback** -- sends users to `/dashboard` or `/`.

### Contexts

- **AuthContext** -- user token, refresh token, user object. Tokens live in React state (never `localStorage`).
- **AdminAuthContext** -- admin token + level (admin/super_admin).
- **ThemeContext** -- light/dark/system, persisted to `localStorage`, follows OS preference.

### API client

`src/lib/api.ts` is a typed fetch wrapper. The base URL resolves from `VITE_API_BASE_URL` (dev: `http://localhost:3000/api/vx`; production: `https://secure-ballot-server.onrender.com/api/vx`). It injects the freshest token via a getter wired at runtime (`AuthBridge`), holds the pre-OTP PART token in-memory only (never in `AuthContext`), and throws a typed `ApiError` carrying `status` and the structured OPS error body.

### UI kit

`src/components/ui/` -- `Badge` (7 variants), `Button` (8 variants), `Card`, `Input`, `ConfirmDialog`, `NotarizedModal`, `LogoMark`. `src/components/auth/AuthBrandPanel` is the marketing panel shown on auth screens.

---

## Database

PostgreSQL via TypeORM (`synchronize: false`, migrations-driven).

### Entities (15)

`users`, `system_admins`, `organizations`, `org_members`, `org_member_profiles`, `organization_auth`, `candidates`, `elections`, `vote_records`, `vote_tallies`, `otp_codes`, `token_blacklist`, `audit_log`, `cold_store`, `role_permissions`.

Key design choices:

- **`vote_records`** records *participation only* (`user` + `election` + timestamp). It has **no `candidate_id`** -- who voted for whom is unknowable by design.
- **`vote_tallies`** holds aggregated counts (`candidate_id` + `election_id` + `vote_count`).
- **`audit_log`** is hash-chained and signed (`entry_hash`, `chain_hash`, `signature`, `sequence_number`).
- **`token_blacklist`** enables token revocation by `jti`.

### Migrations (9, sequential)

```
1786586192545-InitialSchema
1786589092704-AddRolePermissions
1786952446324-CreateSystemAdmin
1786954278847-UpdateOrganization
1787793980885-AddOtpCodes
1787794656795-CreateOtpCodesTable
1788277817700-Establishment
1788500000000-MakeTokenBlacklistUserOptional
1788600000000-AddJoinCode
```


---

## Setup & installation

### Prerequisites

- Bun >= 1.0 (server) -- or Node >= 20
- PostgreSQL 16
- Redis 7

### Server

```bash
cd Secure-ballot-Server
bun install
# Fill in .env (see the existing .env for all required keys)
bun run migration:run        # apply migrations
bun run seed:superadmin      # create the bootstrap super_admin (from SEED_ADMIN_*)
bun run seed:permissions     # load the role-permission matrix
bun run dev                  # start with hot reload (bun --watch src/server.ts)
```

Production: `bun run build && bun run start` (compiles to `dist/`).

### Client

```bash
cd Secure-ballot-Client
bun install   # or: npm install
# Create .env with: VITE_API_BASE_URL=http://localhost:3000/api/vx
bun run dev   # Vite dev server (http://localhost:5173)
```

Production build: `bun run build` (outputs to `dist/`).

### Docker

```bash
cd Secure-ballot-Server
docker-compose up --build          # postgres + redis + server
docker-compose --profile optional up --build   # + MailHog + Bull Board
```

---

## Scripts

### Server (`Secure-ballot-Server`)

| Script | Command | Description |
|---|---|---|
| `dev` | `bun --watch src/server.ts` | Hot-reload dev server |
| `build` | `bun build src/server.ts ...` | Compile to `dist/` |
| `start` | `bun dist/server.js` | Run compiled server |
| `lint` | `eslint src --ext .ts` | Lint |
| `format` | `prettier --write src` | Format |
| `type-check` | `tsc --noEmit` | Type-check |
| `test` | `bun test` | Run tests |
| `migration:run` | `bun run typeorm migration:run` | Apply migrations |
| `migration:generate` | `bun run src/scripts/generate-migration.ts` | Generate a migration |
| `migration:revert` | `bun run typeorm migration:revert` | Revert last migration |
| `seed:permissions` | `bun run src/scripts/seed-permissions.ts` | Load role-permission matrix |
| `seed:superadmin` | `bun run src/scripts/seed-super-admin.ts` | Create bootstrap super_admin |
| `db:nuke` | `bun run src/scripts/nuke-data.ts` | Wipe data |

### Client (`Secure-ballot-Client`)

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Dev server |
| `build` | `vite build` | Production build |
| `preview` | `vite preview` | Preview build |
| `lint` | `eslint .` | Lint |
| `typecheck` | `tsc --noEmit -p tsconfig.app.json` | Type-check |

---

## Security model

- **Anonymity by design** -- `vote_records` has no candidate link; tallies are aggregated.
- **Hash-chained audit log** -- every operation is signed and chained; tampering/missing entries are detectable.
- **Two-layer authorization** -- static role-tier matrix (default-deny) + inline row-level checks. The JWT `range` is never trusted alone.
- **Token ladder** -- coarse PART tokens (pre-OTP, short-lived) cannot perform sensitive actions; FULL tokens require OTP verification.
- **Step-up auth** -- account mutations and password reset require a fresh OTP.
- **Token revocation** -- `token_blacklist` by `jti`; refresh rotates tokens.
- **Rate limiting** -- strict limiter on credential endpoints (10 / 15 min / IP), coarse global backstop (300 / 15 min).
- **Network context** -- client IP is bcrypt-hashed at the edge; correlation IDs trace request chains.
- **Fail-fast config** -- `VALIDATE_ENV()` crashes on startup if any required var is missing.
- **No stack leaks** -- the terminal error handler returns a generic envelope; internal errors get a `stack_ref`, never a raw trace.

### Messaging providers

The server ships multiple notification backends in `src/workers/`, dispatched by config:

| Provider | Channel | Status |
|---|---|---|
| Brevo | Email | Active (default for welcome / OTP / reset) |
| Nodemailer (Gmail SMTP) | Email | Available |
| Vonage | SMS | Active |
| Vonage | WhatsApp | Scaffolded (requires Vonage Application) |
| Textbelt | SMS | Available |

---

## Status & roadmap

From `changelog.md`: authentication is working with modifications incoming; IP/hashing middleware is on hold while the voting flow is implemented.

- [x] User auth (signup/login/OTP/refresh/recovery)
- [x] Admin auth + onboarding
- [x] Organization create / join / member management
- [x] Election lifecycle (draft -> published -> closed -> results)
- [x] Anonymous vote casting + tallies
- [x] OPS audit/integrity layer + hash-chained log
- [ ] Biometric enrollment (client hook is a per-device simulation; real WebAuthn flow pending)
- [ ] Cold-store archival (`cold_store` entity designed, not yet written)
- [ ] Results export / release hardening

---

## Notes

- The client's `package.json` name (`vite-react-typescript-starter`) and `index.html` title are scaffolding leftovers -- cosmetic only.
- `src/data/mockData.ts` provides offline mock orgs/memberships for UI development without a live backend.
- The `useBiometricEnrollment` hook simulates per-device enrollment via `localStorage`; a real implementation needs a per-device WebAuthn credential table.

