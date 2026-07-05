# Social Hours Platform - Backend MVP

Self-hosted backend for managing college social hours in El Salvador. Built with Express + TypeScript + PostgreSQL, following the [technical plan](./social-hours-technical-plan.md) and [OpenAPI contract](./openapi.yml).

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)

### Setup

```bash
# Copy environment file
cp .env.example .env

# Start PostgreSQL
docker compose up -d

# Install dependencies
npm install

# Run migrations and start dev server (seeds run automatically on first boot)
npm run dev
```

The API runs at `http://localhost:3000`. Swagger UI: `http://localhost:3000/docs`

## Deploy en Netlify

Este backend se despliega en Netlify como una **serverless function** (`serverless-http` + Express). PostgreSQL debe estar alojado externamente (por ejemplo [Neon](https://neon.tech), [Supabase](https://supabase.com) o [Railway](https://railway.app)).

### 1. Base de datos

Crea una instancia PostgreSQL y copia la URL de conexión (`DATABASE_URL`).

### 2. Variables de entorno en Netlify

En **Site configuration → Environment variables**, configura:

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URL de PostgreSQL (con SSL si el proveedor lo exige) |
| `JWT_SECRET` | Cadena aleatoria de al menos 16 caracteres |
| `ENCRYPTION_KEY` | 64 caracteres hex (32 bytes) |
| `WEBHOOK_SECRET` | Secreto para firmar webhooks |
| `BASE_URL` | URL del sitio Netlify, p. ej. `https://tu-sitio.netlify.app` |
| `STUDENT_PROFILE_CACHE_TTL_MINUTES` | Opcional, default `30` |

`SKIP_RUNTIME_MIGRATIONS=true` ya está definido en `netlify.toml` para que las migraciones corran solo en el build.

### 3. Conectar el repositorio

1. Sube el proyecto a GitHub/GitLab/Bitbucket.
2. En [Netlify](https://app.netlify.com), **Add new site → Import an existing project**.
3. Netlify detectará `netlify.toml` con:
   - **Build command:** `npm run build && npm run db:prepare`
   - **Functions:** `netlify/functions`
   - **Publish directory:** `public`

### 4. Desarrollo local con Netlify

```bash
npm install
docker compose up -d
cp .env.example .env
npm run build
npm run netlify:dev
```

La API quedará disponible en `http://localhost:8888` (proxy de Netlify Dev).

### 5. Deploy manual (opcional)

```bash
npx netlify login
npx netlify init
npm run netlify:deploy
```

### Endpoints en producción

| Ruta | Descripción |
|------|-------------|
| `/` | Redirige a `/docs` |
| `/docs` | Swagger UI |
| `/health` | Health check |
| `/api/v1/*` | API REST |

### Demo Credentials

| Username      | Password | Role               |
|---------------|----------|--------------------|
| student1      | demo123  | student            |
| coordinator1  | demo123  | coordinator        |
| supervisor1   | demo123  | faculty_supervisor |
| admin1        | demo123  | admin              |
| auditor1      | demo123  | auditor            |

## Demo Walkthrough

### 1. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","password":"demo123"}'
```

Save the `accessToken` from the response.

### 2. View Student Profile

```bash
curl http://localhost:3000/api/v1/me/profile \
  -H "Authorization: Bearer <token>"
```

### 3. List Modules & Capabilities

```bash
curl http://localhost:3000/api/v1/modules \
  -H "Authorization: Bearer <admin-token>"

curl http://localhost:3000/api/v1/capabilities \
  -H "Authorization: Bearer <token>"
```

### 4. Create & Publish a Project (coordinator)

```bash
# Login as coordinator1
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <coord-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Limpieza de playas",
    "description": "Recolección de residuos en playa El Tunco",
    "organizationName": "Surf SV",
    "location": "La Libertad",
    "modality": "onsite",
    "categories": ["environmental", "community"],
    "publicSafe": true
  }'

# Publish (triggers n8n webhook if publicSafe and N8N_WEBHOOK_URL is configured)
curl -X POST http://localhost:3000/api/v1/projects/<projectId>/publish \
  -H "Authorization: Bearer <coord-token>"
```

### 5. Apply to Project (student)

```bash
curl -X POST http://localhost:3000/api/v1/projects/<projectId>/applications \
  -H "Authorization: Bearer <student-token>" \
  -H "Content-Type: application/json" \
  -d '{"motivation": "Me interesa el medio ambiente"}'
```

### 6. Approve Application (coordinator)

```bash
curl -X POST http://localhost:3000/api/v1/applications/<applicationId>/approve \
  -H "Authorization: Bearer <coord-token>"
```

### 7. Log Hours (student)

```bash
curl -X POST http://localhost:3000/api/v1/hour-logs \
  -H "Authorization: Bearer <student-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "assignmentId": "<assignmentId>",
    "date": "2026-03-01",
    "durationHours": 4,
    "category": "environmental",
    "description": "Recolección de basura en playa"
  }'
```

### 8. Firecrawl Import (coordinator)

```bash
curl -X POST http://localhost:3000/api/v1/imports/firecrawl/runs \
  -H "Authorization: Bearer <coord-token>" \
  -H "Content-Type: application/json" \
  -d '{"startUrls":["https://example.org/volunteer"],"maxPages":3}'

# Wait ~2s, then list results
curl http://localhost:3000/api/v1/imports/firecrawl/results \
  -H "Authorization: Bearer <coord-token>"
```

### 9. Evaluate Rules

```bash
curl -X POST http://localhost:3000/api/v1/rules/evaluate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"studentRef":"student:STU-001"}'
```

## Architecture

```
Core (core/) — always on, not installable
  ├── health, auth, student-data, provider-connections
  ├── modules-admin (install/enable/configure modules)
  ├── config (instance settings + SMTP)
  ├── admin-users (platform administrators)
  ├── me (identity only: GET /api/v1/me)
  ├── audit-log, webhooks
  └── student-cache (shared student_refs cache)

Platform (platform/)
  ├── ModuleLoader — discovers modules/*
  ├── ModuleRegistry — lifecycle + migrations per module
  ├── ServiceRegistry — cross-module contracts (rules.v1, hours.v1, …)
  └── EventBus — async hooks between modules

Domain modules (modules/) — installable, own migrations + routes
  ├── dummy-auth-connector, dummy-student-data-connector
  ├── notifications, rules, projects, assignments, applications
  ├── hours, documents, certificates, imports
  ├── student-profile, reports
  └── each module: manifest, services/, routes/, migrations/
```

External integrations: Firecrawl imports use the Firecrawl API, n8n project-publish workflows use a configured webhook URL, and ZAVU notifications remain stubbed for MVP demo purposes.

### n8n Integration

Set `N8N_WEBHOOK_URL` to the production webhook URL of an active n8n workflow. When a `publicSafe` project is published, the backend posts a `project.published` JSON payload to that webhook. Optional settings:

- `N8N_API_KEY`: sent as `X-N8N-API-KEY` when configured.
- `N8N_TIMEOUT_MS`: request timeout, default `15000`.
- `N8N_MAX_RETRIES`: retries for timeouts, `429`, and `5xx`, default `2`.

## Module System

The platform uses an Odoo-like module model. The **core** handles discovery, install/uninstall, enable/disable, configuration (including encrypted API keys/SMTP), feature toggles, and health checks. **Domain features** are modules under `modules/<moduleKey>/`.

### Service contracts

Modules communicate via `ServiceRegistry` using stable contract keys:

| Contract | Provider module |
|----------|-----------------|
| `notifications.v1` | notifications |
| `rules.v1` | rules |
| `projects.v1` | projects |
| `assignments.v1` | assignments |
| `hours.v1` | hours |
| `documents.v1` | documents |
| `student-profile.v1` | student-profile |

### Module lifecycle

1. **Discover** — `GET /api/v1/modules/available`
2. **Install** — creates module tables (own Knex migrations) + seeds
3. **Enable** — mounts routes, registers services, validates dependencies
4. **Configure** — `PUT /api/v1/modules/{moduleKey}/config`
5. **Disable / Uninstall** — uninstall rolls back module migrations

On first boot, all MVP modules are auto-installed and enabled.

### Creating a domain module

```
modules/my-module/
  index.ts              # PlatformModuleDescriptor (export default)
  manifest.ts           # moduleKey, dependencies, requiredServices, providedServices
  contract.ts           # optional public service interface
  services/             # business logic
  routes/               # Express routers
  migrations/           # per-module schema (install/uninstall)
  seeds/                # optional onInstall data
```

Example `index.ts`:

```typescript
import { createBaseDomainModule } from '../../platform/module/BaseDomainModule';
import { moduleMigrationConfig, resolveModuleMigrationsDir } from '../../platform/module/ModuleMigrationRunner';
import { manifest } from './manifest';
import myRoutes from './routes/my.routes';

const descriptor = {
  moduleKey: manifest.moduleKey,
  manifest,
  instance: createBaseDomainModule(manifest),
  getMigrations() {
    return moduleMigrationConfig(manifest.moduleKey, resolveModuleMigrationsDir(manifest.moduleKey));
  },
  getRoutes() {
    return [{ path: '/api/v1/my-feature', router: myRoutes }];
  },
};

export default descriptor;
```

| Command              | Description                    |
|----------------------|--------------------------------|
| `npm run dev`        | Start dev server with hot reload |
| `npm run build`      | Compile TypeScript             |
| `npm run migrate`    | Run database migrations        |
| `npm run seed`       | Seed demo data                 |
| `npm run db:prepare` | Migrations + seeds + modules (build/Netlify) |
| `npm run netlify:dev` | Local API via Netlify Dev proxy |
| `npm run netlify:deploy` | Deploy manual a Netlify   |
| `npm run typecheck`  | TypeScript type checking       |

## API Contract

All endpoints are defined in [openapi.yml](./openapi.yml). The spec is served at `/docs` via Swagger UI.

## Scripts
