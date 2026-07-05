import { createBaseDomainModule } from '../../platform/module/BaseDomainModule';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { STUDENT_PROFILE_V1 } from '../../platform/contracts/services';
import { manifest } from './manifest';
import { studentProfileService } from './services/studentProfile.service';
import profileRoutes from './routes/profile.routes';

const instance = createBaseDomainModule(manifest);

const descriptor: PlatformModuleDescriptor = {
  moduleKey: manifest.moduleKey,
  manifest,
  instance,
  registerServices(registry) {
    registry.provide(STUDENT_PROFILE_V1, manifest.moduleKey, studentProfileService);
  },
  getRoutes() {
    return [{ path: '/api/v1/me', router: profileRoutes }];
  },
};

export default descriptor;
