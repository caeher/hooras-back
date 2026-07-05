import { createBaseDomainModule } from '../../platform/module/BaseDomainModule';
import { moduleMigrationConfig, resolveModuleMigrationsDir } from '../../platform/module/ModuleMigrationRunner';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { PROJECTS_V1 } from '../../platform/contracts/services';
import { manifest } from './manifest';
import { projectsService } from './services/projects.service';
import projectsRoutes from './routes/projects.routes';
import { projectApplicationsRouter } from './routes/projectApplications.routes';

const instance = createBaseDomainModule(manifest);

const descriptor: PlatformModuleDescriptor = {
  moduleKey: manifest.moduleKey,
  manifest,
  instance,
  getMigrations() {
    return moduleMigrationConfig(manifest.moduleKey, resolveModuleMigrationsDir(manifest.moduleKey));
  },
  registerServices(registry) {
    registry.provide(PROJECTS_V1, manifest.moduleKey, projectsService);
  },
  getRoutes() {
    return [
      { path: '/api/v1/projects', router: projectsRoutes },
      { path: '/api/v1/projects/:projectId/applications', router: projectApplicationsRouter },
    ];
  },
};

export default descriptor;
