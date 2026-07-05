import { createBaseDomainModule } from '../../platform/module/BaseDomainModule';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { manifest } from './manifest';
import reportsRoutes from './routes/reports.routes';

const instance = createBaseDomainModule(manifest);

const descriptor: PlatformModuleDescriptor = {
  moduleKey: manifest.moduleKey,
  manifest,
  instance,
  getRoutes() {
    return [{ path: '/api/v1/reports', router: reportsRoutes }];
  },
};

export default descriptor;
