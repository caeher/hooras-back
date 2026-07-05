import db from '../../database';
import { createBaseDomainModule } from '../../platform/module/BaseDomainModule';
import { moduleMigrationConfig, resolveModuleMigrationsDir } from '../../platform/module/ModuleMigrationRunner';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { DOCUMENTS_V1 } from '../../platform/contracts/services';
import { manifest } from './manifest';
import { documentsService } from './services/documents.service';
import documentsRoutes from './routes/documents.routes';
import { documentRequirementsSeed } from './seeds/document_requirements.seed';

const instance = createBaseDomainModule(manifest);

const descriptor: PlatformModuleDescriptor = {
  moduleKey: manifest.moduleKey,
  manifest,
  instance,
  getMigrations() {
    return moduleMigrationConfig(manifest.moduleKey, resolveModuleMigrationsDir(manifest.moduleKey));
  },
  registerServices(registry) {
    registry.provide(DOCUMENTS_V1, manifest.moduleKey, documentsService);
  },
  getRoutes() {
    return [{ path: '/api/v1', router: documentsRoutes }];
  },
  async onInstall() {
    const count = await db('document_requirements').count('id as count').first();
    if (Number(count?.count ?? 0) === 0) {
      await db('document_requirements').insert(documentRequirementsSeed);
    }
  },
};

export default descriptor;
