import db from '../../database';
import { createBaseDomainModule } from '../../platform/module/BaseDomainModule';
import { moduleMigrationConfig, resolveModuleMigrationsDir } from '../../platform/module/ModuleMigrationRunner';
import { PlatformModuleDescriptor } from '../../platform/module/PlatformModule';
import { RULES_V1 } from '../../platform/contracts/services';
import { manifest } from './manifest';
import { rulesService } from './services/rules.service';
import rulesRoutes from './routes/rules.routes';
import { requirementRulesSeed } from './seeds/requirement_rules.seed';

const instance = createBaseDomainModule(manifest);

const descriptor: PlatformModuleDescriptor = {
  moduleKey: manifest.moduleKey,
  manifest,
  instance,
  getMigrations() {
    return moduleMigrationConfig(manifest.moduleKey, resolveModuleMigrationsDir(manifest.moduleKey));
  },
  registerServices(registry) {
    registry.provide(RULES_V1, manifest.moduleKey, rulesService);
  },
  getRoutes() {
    return [{ path: '/api/v1/rules', router: rulesRoutes }];
  },
  async onInstall() {
    const count = await db('requirement_rules').count('id as count').first();
    if (Number(count?.count ?? 0) === 0) {
      await db('requirement_rules').insert(requirementRulesSeed);
    }
  },
};

export default descriptor;
