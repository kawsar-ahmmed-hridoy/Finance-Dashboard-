# Finance Dashboard Backend API

A production-grade, secure, and scalable backend for a Finance Dashboard system built with **NestJS** and **PostgreSQL**.

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Features](#features)
- [Role-Based Access Control](#role-based-access-control)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Authentication Flow](#authentication-flow)
- [Running Tests](#running-tests)
- [Database Seeding](#database-seeding)
- [Assumptions & Design Decisions](#assumptions--design-decisions)

---

## 🛠 Tech Stack

| Layer            | Technology                          |
|------------------|-------------------------------------|
| Runtime          | Node.js 22 (LTS)                    |
| Framework        | NestJS 10                           |
| Language         | TypeScript 5                        |
| Database         | PostgreSQL 16                       |
| ORM              | TypeORM 0.3                         |
| Auth             | Passport.js + JWT (access + refresh)|
| Validation       | class-validator + class-transformer |
| Documentation    | Swagger / OpenAPI 3                 |
| Rate Limiting    | @nestjs/throttler                   |
| Security         | Helmet, CORS, bcrypt (cost 12)      |
| Testing          | Jest + Supertest                    |

---

## 🏗 Architecture Overview

```
src/
├── audit/              # Audit logging for sensitive actions
├── auth/               # JWT auth, refresh tokens, login/register
├── users/              # User CRUD, role management
├── transactions/       # Financial records management
├── dashboard/          # Analytics & summary APIs
├── common/
│   ├── decorators/     # @Roles, @Public, @CurrentUser
│   ├── enums/          # Role enum with hierarchy
│   ├── filters/        # Global HTTP exception filter
│   ├── guards/         # RolesGuard
│   ├── interceptors/   # ResponseInterceptor, LoggingInterceptor
│   └── dto/            # Shared DTOs (pagination)
├── config/             # TypeORM & Throttler config factories
├── database/seeds/     # Database seeder
├── test/               # E2E test setup and specs
└── main.ts             # Bootstrap with Helmet, CORS, Swagger
```

---

## ✨ Features

### Security
- **JWT Access Tokens** (15-minute expiry, configurable)
- **Refresh Token Rotation** — each refresh issues a new token and revokes the used one; suspected reuse triggers full revocation
- **bcrypt** password hashing with cost factor 12
- **Helmet** HTTP security headers
- **CORS** whitelist configuration
- **Rate limiting** — two-tier (per-second + per-minute), stricter on auth endpoints
- **Audit logs** for sensitive actions (auth lifecycle, user updates/deletes, transaction writes/exports)
- **Self-delete protection** — admins cannot delete their own account
- **Password change** invalidates all active sessions

### Data Management
- **Soft deletes** on all entities (recoverable, audit-safe)
- **Pagination** on all list endpoints (page/limit, max 100 per page)
- **Full-text search** on transactions (description, reference)
- **Flexible filtering** — type, category, status, date range, amount range
- **Bulk delete** endpoint for transactions
- **CSV export** endpoint for filtered transaction data
- **JSONB metadata** field on transactions for extensible data

### Analytics (Dashboard)
- Full overview in a single request
- Income / expense / net balance summary
- Category-wise percentage breakdown
- Trend data: weekly / monthly / quarterly / yearly
- Month-over-month comparison with % change
- Net worth history
- Recent activity feed

### Developer Experience
- **Swagger UI** at `/api/docs` (disabled by default; enable only in local development with `SWAGGER_ENABLED=true`)
- Consistent `{ success, data, timestamp }` response envelope
- Structured error responses with path + timestamp
- `/api/v1/health` endpoint with DB connectivity check
- Database seeder with realistic 6-month sample data
- Unit tests for all three services

---

## 🔐 Role-Based Access Control

Roles form a **hierarchy** — higher roles inherit lower role permissions.

| Permission                           | Viewer | Analyst | Admin  |
|--------------------------------------|:------:|:-------:|:-----: |
| View own transactions                |   ✅   |    ✅   |  ✅   |
| View all users' transactions         |   ❌   |    ❌   |  ✅   |
| Create transactions                  |   ❌   |    ✅   |  ✅   |
| Update/delete own transactions       |   ❌   |    ✅   |  ✅   |
| Update/delete any transaction        |   ❌   |    ❌   |  ✅   |
| View dashboard (own data)            |   ✅   |    ✅   |  ✅   |
| View system-wide dashboard           |   ❌   |    ❌   |  ✅   |
| Access net-worth history             |   ❌   |    ✅   |  ✅   |
| View/manage all users                |   ❌   |    ❌   |  ✅   |
| Create users with any role           |   ❌   |    ❌   |  ✅   |
| Update own profile (name)            |   ✅   |    ✅   |  ✅   |

---

## 📁 Project Structure

```
finance-backend/
├── src/
│   ├── audit/
│   │   ├── entities/audit-log.entity.ts
│   │   ├── audit.module.ts
│   │   └── audit.service.ts
│   ├── auth/
│   │   ├── dto/auth.dto.ts
│   │   ├── entities/refresh-token.entity.ts
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── strategies/jwt.strategy.ts
│   │   ├── strategies/local.strategy.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   └── auth.service.spec.ts
│   ├── users/
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   ├── update-user.dto.ts
│   │   │   └── query-users.dto.ts
│   │   ├── entities/user.entity.ts
│   │   ├── users.controller.ts
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   └── users.service.spec.ts
│   ├── transactions/
│   │   ├── dto/
│   │   │   ├── create-transaction.dto.ts
│   │   │   ├── update-transaction.dto.ts
│   │   │   └── query-transactions.dto.ts
│   │   ├── entities/transaction.entity.ts
│   │   ├── enums/transaction.enum.ts
│   │   ├── transactions.controller.ts
│   │   ├── transactions.module.ts
│   │   ├── transactions.service.ts
│   │   └── transactions.service.spec.ts
│   ├── dashboard/
│   │   ├── dto/dashboard-query.dto.ts
│   │   ├── dashboard.controller.ts
│   │   ├── dashboard.module.ts
│   │   └── dashboard.service.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── public.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── dto/pagination.dto.ts
│   │   ├── enums/role.enum.ts
│   │   ├── filters/http-exception.filter.ts
│   │   ├── guards/roles.guard.ts
│   │   └── interceptors/
│   │       ├── logging.interceptor.ts
│   │       └── response.interceptor.ts
│   ├── config/
│   │   ├── typeorm.config.ts
│   │   └── throttler.config.ts
│   ├── database/seeds/seed.ts
│   ├── health.controller.ts
│   ├── app.module.ts
│   └── main.ts
├── .env.example
├── nest-cli.json
├── package.json
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- npm 10+

### 1. Clone & Install

```bash
git clone <repo-url>
cd finance-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secrets
```

The repository now includes [`.env.example`](.env.example) with the required runtime, Swagger, and seed variables.

### 3. Create the Database

```sql
CREATE DATABASE finance_db;
```

### 4. Start the Server

```bash
# Development (with hot reload)
npm run start:dev

# Production build
npm run build && npm run start:prod
```

The API will be live at `http://localhost:3000/api`  
Swagger docs are available at `http://localhost:3000/api/docs` only when `NODE_ENV=development` and `SWAGGER_ENABLED=true`.

---

## 🔧 Environment Variables

| Variable                | Description                               | Default           |
|-------------------------|-------------------------------------------|-------------------|
| `NODE_ENV`              | Environment (`development`/`production`)  | `development`     |
| `PORT`                  | HTTP port                                 | `3000`            |
| `DB_HOST`               | PostgreSQL host                           | `localhost`       |
| `DB_PORT`               | PostgreSQL port                           | `5432`            |
| `DB_USERNAME`           | PostgreSQL user                           | `postgres`        |
| `DB_PASSWORD`           | PostgreSQL password                       | —                 |
| `DB_NAME`               | PostgreSQL database name                  | `finance_db`      |
| `DB_SYNC`               | Auto-sync schema (**false in prod**)      | `false`           |
| `DB_LOGGING`            | Log SQL queries                           | `false`           |
| `JWT_SECRET`            | Access token secret (required)            | required          |
| `JWT_EXPIRES_IN`        | Access token lifetime                     | `15m`             |
| `JWT_REFRESH_SECRET`    | Refresh token secret (if used by deployment tooling) | optional |
| `JWT_REFRESH_EXPIRES_IN`| Refresh token lifetime                    | `7d`              |
| `THROTTLE_TTL`          | Rate limit window in milliseconds         | `60000`           |
| `THROTTLE_LIMIT`        | Max requests per window                   | `100`             |
| `CORS_ORIGINS`          | Comma-separated allowed origins           | `http://localhost:3001`  |
| `TRUST_PROXY`           | Trust reverse proxy headers (`X-Forwarded-*`) | `false`     |
| `SWAGGER_ENABLED`       | Enable Swagger in development mode only   | `false`           |
| `SEED_ADMIN_PASSWORD`   | Seed script password for admin account    | required for seed |
| `SEED_ANALYST_PASSWORD` | Seed script password for analyst account  | required for seed |
| `SEED_VIEWER_PASSWORD`  | Seed script password for viewer account   | required for seed |

---

## 📡 API Reference

All routes are prefixed with `/api/v1`.

### Auth — `/api/v1/auth`

| Method | Endpoint             | Auth | Description                              |
|--------|----------------------|------|------------------------------------------|
| POST   | `/register`          | ❌   | Self-register (Viewer role)              |
| POST   | `/login`             | ❌   | Login, receive access + refresh token    |
| POST   | `/refresh`           | ❌   | Refresh token rotation                   |
| POST   | `/logout`            | ✅   | Revoke current refresh token             |
| POST   | `/logout-all`        | ✅   | Revoke all refresh tokens (all devices)  |
| POST   | `/change-password`   | ✅   | Change password (invalidates sessions)   |

### Users — `/api/v1/users`

| Method | Endpoint    | Role    | Description                        |
|--------|-------------|---------|------------------------------------|
| POST   | `/`         | Admin   | Create user with any role          |
| GET    | `/`         | Admin   | List users (filter, paginate)      |
| GET    | `/me`       | Any     | Get own profile                    |
| GET    | `/stats`    | Admin   | User count per role                |
| GET    | `/:id`      | Admin   | Get any user by ID                 |
| PATCH  | `/me`       | Any     | Update own name                    |
| PATCH  | `/:id`      | Admin   | Update any user's role/status      |
| DELETE | `/:id`      | Admin   | Soft-delete a user                 |

### Transactions — `/api/v1/transactions`

| Method | Endpoint     | Role              | Description                               |
|--------|--------------|-------------------|-------------------------------------------|
| POST   | `/`          | Analyst, Admin    | Create transaction                        |
| GET    | `/`          | Any               | List (Admin=all, others=own only)         |
| GET    | `/export/csv`| Any               | Export filtered transactions as CSV       |
| GET    | `/:id`       | Any               | Get one (own or Admin)                    |
| PATCH  | `/:id`       | Analyst(own)/Admin| Update transaction                        |
| DELETE | `/bulk`      | Analyst(own)/Admin| Bulk soft-delete by array of IDs          |
| DELETE | `/:id`       | Analyst(own)/Admin| Soft-delete single transaction            |

**Query parameters for GET `/transactions`:**

| Param        | Type     | Description                             |
|--------------|----------|-----------------------------------------|
| `page`       | number   | Page number (default: 1)                |
| `limit`      | number   | Items per page (default: 20, max: 100)  |
| `type`       | enum     | `income` / `expense` / `transfer`       |
| `category`   | enum     | See TransactionCategory enum            |
| `status`     | enum     | `pending` / `completed` / `failed` / `cancelled` |
| `dateFrom`   | date     | Start date `YYYY-MM-DD`                 |
| `dateTo`     | date     | End date `YYYY-MM-DD`                   |
| `amountMin`  | number   | Minimum amount filter                   |
| `amountMax`  | number   | Maximum amount filter                   |
| `search`     | string   | Search in description / reference       |
| `sortBy`     | string   | `amount` / `transactionDate` / `createdAt` |
| `sortOrder`  | string   | `ASC` / `DESC`                          |

### Dashboard — `/api/v1/dashboard`

| Method | Endpoint              | Role              | Description                                |
|--------|-----------------------|-------------------|--------------------------------------------|
| GET    | `/overview`           | Any               | Full dashboard in one request              |
| GET    | `/summary`            | Any               | Total income, expenses, net balance        |
| GET    | `/categories`         | Any               | Category-wise breakdown with percentages   |
| GET    | `/trends`             | Any               | Periodic trend data (weekly/monthly/etc)   |
| GET    | `/recent`             | Any               | Last 10 transactions                       |
| GET    | `/monthly-comparison` | Any               | Current vs previous month + % change       |
| GET    | `/net-worth-history`  | Analyst, Admin    | Net worth over N months                    |

**Query parameters for `/trends`:**

| Param     | Type   | Description                              |
|-----------|--------|------------------------------------------|
| `period`  | enum   | `weekly` / `monthly` / `quarterly` / `yearly` |
| `periods` | number | Number of periods to return (max: 24)   |
| `userId`  | uuid   | Filter by user ID (Admin only)           |

### Health — `/api/v1/health`

| Method | Endpoint  | Auth | Description             |
|--------|-----------|------|-------------------------|
| GET    | `/health` | ❌   | API + DB health status  |

---

## 🔑 Authentication Flow

```
1. POST /api/v1/auth/login
   → { user, tokens: { accessToken, refreshToken, expiresIn } }

2. Include in all requests:
   Authorization: Bearer <accessToken>

3. When access token expires (15 min):
   POST /api/v1/auth/refresh  { refreshToken }
   → { accessToken, refreshToken, expiresIn }
   (old refresh token is revoked — rotation)

4. Logout:
   POST /api/v1/auth/logout  { refreshToken }
```

---

## 🧪 Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

---

## 🌱 Database Seeding

```bash
npm run seed
```

Creates the following accounts and 6 months of sample transactions:

| Role    | Email                  | Password       |
|---------|------------------------|----------------|
| Admin   | admin@finance.com      | Admin@1234     |
| Analyst | analyst@finance.com    | Analyst@1234   |
| Viewer  | viewer@finance.com     | Viewer@1234    |

---

## 💡 Assumptions & Design Decisions

### Authentication
- **Refresh token rotation** is used as the primary replay-attack mitigation. If a used refresh token is presented again, all tokens for that user are immediately revoked (token reuse detection).
- Access tokens are short-lived (15 min) and stateless — revocation is via refresh token invalidation only.
- `self-register` gives everyone the `Viewer` role; only Admins can create Analyst/Admin accounts.

### Access Control
- The `RolesGuard` uses a **hierarchy model** — role levels are: Viewer=1, Analyst=2, Admin=3. A role check for Analyst passes if the user's level ≥ 2.
- Transaction ownership: Viewers can read their own; Analysts can read/write their own; Admins have full access to all.

### Data Modeling
- `amount` is stored as `DECIMAL(15,2)` for financial precision (avoids floating-point drift).
- `transactionDate` is a `DATE` column (not timestamp) — the date the transaction occurred, separate from `createdAt` (when the record was entered).
- Soft deletes are used throughout for audit trail preservation.
- `Transaction.metadata` is `JSONB` for future extensibility without schema migrations.
- `AuditLog.details` is stored as `JSONB` so event payloads can evolve without schema churn.
- `refresh_tokens.tokenHash` stores a SHA-256 hash instead of the raw refresh token.

### Dashboard Queries
- All aggregation is done via TypeORM QueryBuilder with raw SQL expressions for `SUM`, `DATE_TRUNC`, and `GROUP BY` — avoiding N+1 and in-memory aggregation.
- Monthly comparison always compares the full previous calendar month against the current month up to today.

### Scalability
- Connection pool configured (max 20 connections).
- All list queries are paginated (max 100 items).
- Indexes on `type`, `category`, `transactionDate`, `createdById`, and `status` columns for query performance.
- Rate limiting is two-tiered: 10 req/sec burst + 100 req/min sustained; auth endpoints are stricter (5/min login, 3/min register).
