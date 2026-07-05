import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { env } from './config/env';
import { resolveCorsOptions } from './config/cors';
import { resolveBundledAsset } from './config/runtime';
import { authMiddleware, optionalAuth } from './app/middleware/auth';
import { studentWhitelist } from './app/middleware/studentWhitelist';

import healthRoutes from './core/health/health.routes';
import setupRoutes from './core/setup/setup.routes';
import modulesRoutes from './core/modules-admin/modules.routes';
import providerConnectionsRoutes from './core/provider-connections/providerConnections.routes';
import authRoutes from './core/auth/auth.routes';
import studentDataRoutes from './core/student-data/studentData.routes';
import meRoutes from './core/me/me.routes';
import studentMeRoutes from './core/me/studentMe.routes';
import auditRoutes from './core/audit/audit.routes';
import webhooksRoutes from './core/webhooks/webhooks.routes';
import configRoutes from './core/config/config.routes';
import adminUsersRoutes from './core/admin-users/adminUsers.routes';
import filesRoutes from './core/files/files.routes';

export function createApp() {
  const app = express();

  app.get('/', (_req, res) => {
    res.redirect('/docs');
  });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors(resolveCorsOptions(env.CORS_ORIGINS)));
  app.use(express.json());

  app.use('/api/v1', optionalAuth, studentWhitelist);

  const openapiPath = resolveBundledAsset('openapi.yml');
  try {
    const spec = parseYaml(readFileSync(openapiPath, 'utf8'));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
  } catch {
    console.warn('Could not load openapi.yml for Swagger UI');
  }

  app.use(healthRoutes);

  app.use('/api/v1/setup', setupRoutes);

  app.use('/api/v1/modules', modulesRoutes);
  app.use('/api/v1/provider-connections', providerConnectionsRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/student-data', studentDataRoutes);
  app.use('/api/v1/me', meRoutes);
  app.use('/api/v1/me', studentMeRoutes);
  app.use('/api/v1/audit-log', auditRoutes);
  app.use('/api/v1/webhooks', webhooksRoutes);
  app.use('/api/v1/config', configRoutes);
  app.use('/api/v1/admin-users', adminUsersRoutes);
  app.use('/api/v1/files', filesRoutes);

  app.get('/api/v1/capabilities', authMiddleware, async (_req, res, next) => {
    try {
      const { ModuleRegistry } = await import('./platform/registry/ModuleRegistry');
      const capabilities = await ModuleRegistry.getCapabilities();
      res.json(capabilities);
    } catch (e) {
      next(e);
    }
  });

  return app;
}
