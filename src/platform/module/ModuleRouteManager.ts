import { Express, Router, Request, Response, NextFunction } from 'express';
import { ModuleRouteRegistration } from './PlatformModule';

class ModuleRouteManagerClass {
  private enabled = new Set<string>();
  private registered = new Set<string>();

  registerModuleRoutes(
    app: Express,
    moduleKey: string,
    registrations: ModuleRouteRegistration[]
  ): void {
    if (this.registered.has(moduleKey)) return;

    for (const { path, router } of registrations) {
      const gate = Router();
      gate.use((req: Request, res: Response, next: NextFunction) => {
        if (!this.enabled.has(moduleKey)) {
          return res.status(503).json({
            error: 'module_disabled',
            message: `Module ${moduleKey} is not enabled`,
          });
        }
        next();
      });
      gate.use(router);
      app.use(path, gate);
    }
    this.registered.add(moduleKey);
  }

  enableRoutes(moduleKey: string): void {
    this.enabled.add(moduleKey);
  }

  disableRoutes(moduleKey: string): void {
    this.enabled.delete(moduleKey);
  }

  isRouteEnabled(moduleKey: string): boolean {
    return this.enabled.has(moduleKey);
  }
}

export const ModuleRouteManager = new ModuleRouteManagerClass();
