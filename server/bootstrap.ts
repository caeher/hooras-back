import { Express } from 'express';
import { createApp } from '../app';
import db from '../database';
import { env } from '../config/env';
import { ModuleLoader } from '../platform/module/ModuleLoader';
import { BUILTIN_MODULE_KEYS } from '../platform/registry/moduleCatalog';
import { ModuleRegistry } from '../platform/registry/ModuleRegistry';
import { SetupService } from '../core/setup/SetupService';
import { runModuleMigrations } from '../platform/module/ModuleMigrationRunner';
import { errorHandler } from '../app/middleware/errorHandler';

const DEFAULT_MODULE_KEYS = [...BUILTIN_MODULE_KEYS] as const;

function assertCatalogContainsRequiredModules(
  descriptors: Array<{ moduleKey: string }>,
  requiredModuleKeys: readonly string[],
): void {
  const loadedKeys = new Set(descriptors.map((descriptor) => descriptor.moduleKey));
  const missing = requiredModuleKeys.filter((moduleKey) => !loadedKeys.has(moduleKey));
  if (missing.length > 0) {
    throw new Error(
      `Module catalog is incomplete. Missing descriptors for: ${missing.join(', ')}`,
    );
  }
}

export interface BootstrapOptions {
  skipMigrations?: boolean;
}

export async function prepareDatabaseEnvironment(
  options: BootstrapOptions = {},
): Promise<void> {
  const descriptors = await ModuleLoader.loadFromPath();
  assertCatalogContainsRequiredModules(descriptors, DEFAULT_MODULE_KEYS);
  ModuleRegistry.loadCatalog(descriptors);

  if (!options.skipMigrations) {
    await db.migrate.latest();

    // Ensure all installed modules have their database schemas fully migrated on startup
    const installed = await db('installed_modules').select('module_key');
    for (const row of installed) {
      const descriptor = descriptors.find((d) => d.moduleKey === row.module_key);
      if (descriptor?.getMigrations) {
        await runModuleMigrations(descriptor.getMigrations());
      }
    }
  }

  if (env.NODE_ENV === 'test') {
    const demoUserCount = await db('demo_users').count('id as count').first();
    if (Number(demoUserCount?.count ?? 0) === 0) {
      await db.seed.run();
    }

    if (!(await SetupService.isComplete())) {
      await ModuleRegistry.ensureDefaultModulesInstalled([...DEFAULT_MODULE_KEYS]);
      await SetupService.markLegacyComplete();
    } else {
      await ModuleRegistry.ensureDefaultModulesInstalled([...DEFAULT_MODULE_KEYS]);
      await ModuleRegistry.bootstrapEnabledModules();
    }
    return;
  }

  if (await SetupService.isComplete()) {
    await ModuleRegistry.ensureDefaultModulesInstalled([...DEFAULT_MODULE_KEYS]);
    await ModuleRegistry.bootstrapEnabledModules();
  }
}

export function createConfiguredApp(): Express {
  const app = createApp();
  ModuleRegistry.initApp(app);
  app.use(errorHandler);
  return app;
}

export async function bootstrapPlatform(options: BootstrapOptions = {}): Promise<Express> {
  await prepareDatabaseEnvironment(options);
  return createConfiguredApp();
}
