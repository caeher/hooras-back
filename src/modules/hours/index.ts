import { createBaseDomainModule } from '../../platform/module/BaseDomainModule';
import { moduleMigrationConfig, resolveModuleMigrationsDir } from '../../platform/module/ModuleMigrationRunner';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { HOURS_V1 } from '../../platform/contracts/services';
import { manifest } from './manifest';
import { hoursService } from './services/hours.service';
import hourLogsRoutes from './routes/hourLogs.routes';

const instance = createBaseDomainModule(manifest);

const descriptor: PlatformModuleDescriptor = {
  moduleKey: manifest.moduleKey,
  manifest,
  instance,
  getMigrations() {
    return moduleMigrationConfig(manifest.moduleKey, resolveModuleMigrationsDir(manifest.moduleKey));
  },
  registerServices(registry) {
    registry.provide(HOURS_V1, manifest.moduleKey, hoursService);
  },
  getRoutes() {
    return [{ path: '/api/v1/hour-logs', router: hourLogsRoutes }];
  },
};

export default descriptor;
