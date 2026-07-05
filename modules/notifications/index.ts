import { createBaseDomainModule } from '../../platform/module/BaseDomainModule';
import { moduleMigrationConfig, resolveModuleMigrationsDir } from '../../platform/module/ModuleMigrationRunner';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { NOTIFICATIONS_V1 } from '../../platform/contracts/services';
import { manifest } from './manifest';
import { notificationsService } from './services/notifications.service';
import meNotificationsRoutes from './routes/meNotifications.routes';

const instance = createBaseDomainModule(manifest);

const descriptor: PlatformModuleDescriptor = {
  moduleKey: manifest.moduleKey,
  manifest,
  instance,
  getMigrations() {
    return moduleMigrationConfig(manifest.moduleKey, resolveModuleMigrationsDir(manifest.moduleKey));
  },
  registerServices(registry) {
    registry.provide(NOTIFICATIONS_V1, manifest.moduleKey, notificationsService);
  },
  getRoutes() {
    return [{ path: '/api/v1/me', router: meNotificationsRoutes }];
  },
};

export default descriptor;
