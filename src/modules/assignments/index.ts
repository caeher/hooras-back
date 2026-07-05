import { createBaseDomainModule } from '../../platform/module/BaseDomainModule';
import { moduleMigrationConfig, resolveModuleMigrationsDir } from '../../platform/module/ModuleMigrationRunner';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { ASSIGNMENTS_V1 } from '../../platform/contracts/services';
import { manifest } from './manifest';
import { assignmentsService } from './services/assignments.service';
import assignmentsRoutes from './routes/assignments.routes';

const instance = createBaseDomainModule(manifest);

const descriptor: PlatformModuleDescriptor = {
  moduleKey: manifest.moduleKey,
  manifest,
  instance,
  getMigrations() {
    return moduleMigrationConfig(manifest.moduleKey, resolveModuleMigrationsDir(manifest.moduleKey));
  },
  registerServices(registry) {
    registry.provide(ASSIGNMENTS_V1, manifest.moduleKey, assignmentsService);
  },
  getRoutes() {
    return [{ path: '/api/v1/assignments', router: assignmentsRoutes }];
  },
};

export default descriptor;
