import { Express } from 'express';
import { createApp } from '../../app';
import { BUILTIN_MODULE_DESCRIPTORS } from '../../platform/registry/moduleCatalog';
import { ModuleRouteManager } from '../../platform/module/ModuleRouteManager';

/** Express app with every built-in module route mounted (no database). */
export function createAppForSpec(): Express {
  const app = createApp();

  for (const descriptor of BUILTIN_MODULE_DESCRIPTORS) {
    if (!descriptor.getRoutes) continue;
    ModuleRouteManager.enableRoutes(descriptor.moduleKey);
    ModuleRouteManager.registerModuleRoutes(app, descriptor.moduleKey, descriptor.getRoutes());
  }

  return app;
}
