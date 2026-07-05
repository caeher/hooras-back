import { createBaseDomainModule } from '../../platform/module/BaseDomainModule';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { manifest } from './manifest';
import jobSearchRouter from './routes/jobSearch.routes';

const instance = createBaseDomainModule(manifest);

const descriptor: PlatformModuleDescriptor = {
  moduleKey: manifest.moduleKey,
  manifest,
  instance,
  getRoutes() {
    return [
      { path: '/api/v1/job-search', router: jobSearchRouter },
    ];
  },
};

export default descriptor;
