import { env } from '../../config/env';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { dummyStudentDataConnector } from './DummyStudentDataConnector';
import { dummyStudentDataManifest } from './manifest';
import demoStudentDataRoutes from './demo-student-data/routes';

const descriptor: PlatformModuleDescriptor = {
  moduleKey: dummyStudentDataManifest.moduleKey,
  manifest: dummyStudentDataManifest,
  instance: dummyStudentDataConnector,

  getDefaultConfig() {
    return {
      values: { providerProfile: 'progress_percentage' },
      secrets: { apiBaseUrl: `${env.BASE_URL}/demo-student-data` },
    };
  },

  getRoutes() {
    return [{ path: '/demo-student-data', router: demoStudentDataRoutes }];
  },
};

export default descriptor;
