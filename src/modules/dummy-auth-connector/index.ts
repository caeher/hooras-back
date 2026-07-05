import { env } from '../../config/env';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { dummyAuthConnector } from './DummyAuthConnector';
import { dummyAuthManifest } from './manifest';
import demoAuthRoutes from './demo-auth/routes';

const descriptor: PlatformModuleDescriptor = {
  moduleKey: dummyAuthManifest.moduleKey,
  manifest: dummyAuthManifest,
  instance: dummyAuthConnector,

  getDefaultConfig() {
    return {
      values: { providerProfile: 'default' },
      secrets: { apiBaseUrl: `${env.BASE_URL}/demo-auth` },
    };
  },

  getRoutes() {
    return [{ path: '/demo-auth', router: demoAuthRoutes }];
  },
};

export default descriptor;
