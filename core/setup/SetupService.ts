import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../../database';
import { resolvePublicBaseUrl } from '../../config/publicUrl';
import { BadRequestError, ConflictError } from '../../app/utils/errors';
import { ModuleRegistry } from '../../platform/registry/ModuleRegistry';
import { sortModuleKeysByDependencies } from '../../platform/registry/sortModuleKeysByDependencies';
import {
  getInstanceRow,
  getInstanceSettings,
  parseInstanceSettings,
  updateInstanceSettings,
} from './instanceSettings';
import type { ModuleType } from '../../platform/types';

const CONNECTOR_TYPES = {
  auth: 'auth_connector',
  'student-data': 'student_data_connector',
} as const;

type ConnectorRouteType = keyof typeof CONNECTOR_TYPES;

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function parseSettings(value: unknown) {
  return parseInstanceSettings(value);
}

async function readInstanceRow() {
  return getInstanceRow();
}

function resolveModuleDependencies(moduleKeys: string[]): string[] {
  return sortModuleKeysByDependencies(moduleKeys, (moduleKey) => {
    const descriptor = ModuleRegistry.getDescriptor(moduleKey);
    const deps = new Set(descriptor.manifest.dependencies ?? []);

    for (const service of descriptor.manifest.requiredServices ?? []) {
      for (const item of ModuleRegistry.listCatalogDescriptors()) {
        if (item.manifest.providedServices?.includes(service)) {
          deps.add(item.moduleKey);
          break;
        }
      }
    }

    return Array.from(deps);
  });
}

export class SetupServiceClass {
  async getInstanceSettings() {
    return getInstanceSettings();
  }

  async isComplete(): Promise<boolean> {
    const settings = await getInstanceSettings();
    return settings.setupCompleted === true;
  }

  async updateSettings(patch: Parameters<typeof updateInstanceSettings>[0]) {
    return updateInstanceSettings(patch);
  }

  async setActiveConnector(
    connectorKey: 'auth' | 'student_data',
    moduleKey: string,
  ): Promise<void> {
    await updateInstanceSettings({
      activeConnectors: { [connectorKey]: moduleKey },
    });
  }

  async getStatus() {
    const row = await readInstanceRow();
    const settings = parseSettings(row.settings);
    const requirements = await this.getSetupRequirements();
    const completed = settings.setupCompleted === true;

    const enabledModuleCount = Number(
      (await db('installed_modules').where({ enabled: true }).count('* as count').first())?.count ?? 0,
    );

    return {
      completed,
      collegeName: row.college_name as string,
      settings: {
        locale: settings.locale ?? 'es-SV',
        timezone: settings.timezone ?? 'America/El_Salvador',
        demoMode: settings.demoMode ?? false,
        activeConnectors: settings.activeConnectors ?? {},
      },
      steps: {
        instance: Boolean((row.college_name as string)?.trim()),
        authConnector: Boolean(settings.activeConnectors?.auth),
        studentDataConnector: Boolean(settings.activeConnectors?.student_data),
        modules: enabledModuleCount > 0,
        admin: Number((await db('admin_users').count('* as count').first())?.count ?? 0) > 0,
      },
      missingRequirements: requirements,
    };
  }

  async getSetupRequirements(): Promise<string[]> {
    const row = await readInstanceRow();
    const settings = parseSettings(row.settings);
    const missing: string[] = [];

    if (!(row.college_name as string)?.trim()) {
      missing.push('instance.collegeName');
    }
    if (!settings.activeConnectors?.auth) {
      missing.push('connectors.auth');
    }
    if (!settings.activeConnectors?.student_data) {
      missing.push('connectors.student_data');
    }

    const adminCount = await db('admin_users').count('* as count').first();
    if (Number(adminCount?.count ?? 0) === 0) {
      missing.push('admin.initialUser');
    }

    return missing;
  }

  async listModulesForSetup(moduleType?: ModuleType) {
    const available = await ModuleRegistry.listAvailableForSetup();
    if (!moduleType) return available;
    return available.filter((m) => m.moduleType === moduleType);
  }

  async saveInstance(data: {
    collegeName: string;
    locale?: string;
    timezone?: string;
    demoMode?: boolean;
  }) {
    const row = await readInstanceRow();
    const current = parseSettings(row.settings);

    await db('instance_settings')
      .where({ id: row.id })
      .update({
        college_name: data.collegeName,
        settings: JSON.stringify({
          ...current,
          locale: data.locale ?? current.locale ?? 'es-SV',
          timezone: data.timezone ?? current.timezone ?? 'America/El_Salvador',
          demoMode: data.demoMode ?? current.demoMode ?? false,
        }),
        updated_at: new Date(),
      });

    return this.getStatus();
  }

  async configureConnector(
    routeType: ConnectorRouteType,
    data: {
      moduleKey: string;
      useDemoProvider?: boolean;
      values?: Record<string, unknown>;
      secrets?: Record<string, string>;
      features?: Array<{ featureKey: string; enabled: boolean }>;
    },
  ) {
    const moduleType = CONNECTOR_TYPES[routeType];
    const manifest = ModuleRegistry.getManifest(data.moduleKey);
    if (manifest.moduleType !== moduleType) {
      throw new BadRequestError(`Module ${data.moduleKey} is not a ${moduleType}`);
    }

    const defaults = ModuleRegistry.getDescriptor(data.moduleKey).getDefaultConfig?.();
    const values = { ...(defaults?.values ?? {}), ...(data.values ?? {}) };
    const secrets = { ...(defaults?.secrets ?? {}), ...(data.secrets ?? {}) };

    if (data.useDemoProvider !== false && defaults?.secrets?.apiBaseUrl) {
      secrets.apiBaseUrl = defaults.secrets.apiBaseUrl;
    } else if (data.useDemoProvider === false && !secrets.apiBaseUrl) {
      throw new BadRequestError('apiBaseUrl is required for external provider');
    }

    await ModuleRegistry.setActiveConnector(moduleType, data.moduleKey);
    await ModuleRegistry.configureModule(data.moduleKey, values, secrets);

    if (data.features?.length) {
      await ModuleRegistry.setFeatures(data.moduleKey, data.features);
    }

    const settingsKey = routeType === 'auth' ? 'auth' : 'student_data';
    await this.setActiveConnector(settingsKey, data.moduleKey);

    return this.getStatus();
  }

  async configureModules(moduleKeys: string[]) {
    const settings = await getInstanceSettings();
    const connectorKeys = [
      settings.activeConnectors?.auth,
      settings.activeConnectors?.student_data,
    ].filter(Boolean) as string[];

    const targetKeys = resolveModuleDependencies([...new Set([...connectorKeys, ...moduleKeys])]);

    for (const moduleKey of targetKeys) {
      if (!(await ModuleRegistry.isInstalled(moduleKey))) {
        await ModuleRegistry.installModule(moduleKey);
      }
      const row = await db('installed_modules').where({ module_key: moduleKey }).first();
      if (!row?.enabled) {
        await ModuleRegistry.enableModule(moduleKey);
      }
    }

    const domainInstalled = await db('installed_modules')
      .whereNotIn('module_type', ['auth_connector', 'student_data_connector'])
      .select('module_key');

    for (const row of domainInstalled) {
      const key = row.module_key as string;
      if (!targetKeys.includes(key)) {
        const installed = await db('installed_modules').where({ module_key: key, enabled: true }).first();
        if (installed) {
          await ModuleRegistry.disableModule(key);
        }
      }
    }

    return this.getStatus();
  }

  async createAdmin(data: {
    username: string;
    password: string;
    displayName?: string;
    email?: string;
  }) {
    const existing = await db('admin_users').where({ username: data.username }).first();
    if (existing) {
      throw new ConflictError(`Admin user ${data.username} already exists`);
    }

    await db('admin_users').insert({
      id: uuidv4(),
      username: data.username,
      password_hash: hashPassword(data.password),
      display_name: data.displayName ?? data.username,
      email: data.email,
      roles: JSON.stringify(['admin']),
      active: true,
    });

    const settings = await getInstanceSettings();
    const authModuleKey = settings.activeConnectors?.auth;
    if (authModuleKey === 'dummy-auth-connector') {
      const demoExisting = await db('demo_users').where({ username: data.username }).first();
      if (!demoExisting) {
        await db('demo_users').insert({
          username: data.username,
          password_hash: hashPassword(data.password),
          external_user_id: `usr-admin-${uuidv4().slice(0, 8)}`,
          display_name: data.displayName ?? data.username,
          email: data.email,
          roles: JSON.stringify(['admin']),
          provider_profile: 'default',
        });
      }
    }

    return this.getStatus();
  }

  async testConnectors() {
    const settings = await getInstanceSettings();
    const results: Array<{ type: string; moduleKey: string; ok: boolean; message?: string }> = [];

    for (const [type, moduleKey] of Object.entries(settings.activeConnectors ?? {})) {
      if (!moduleKey) continue;
      try {
        const result = await ModuleRegistry.testModule(moduleKey);
        results.push({
          type,
          moduleKey,
          ok: result.status === 'success',
          message: result.message,
        });
      } catch (err) {
        results.push({
          type,
          moduleKey,
          ok: false,
          message: err instanceof Error ? err.message : 'Test failed',
        });
      }
    }

    return { results, allOk: results.every((r) => r.ok) };
  }

  async runDemoSeeds() {
    await db.seed.run();
  }

  async complete() {
    const missing = await this.getSetupRequirements();
    if (missing.length > 0) {
      throw new BadRequestError('Setup requirements not met', 'SETUP_INCOMPLETE', { missing });
    }

    const settings = await getInstanceSettings();

    const demoMode = settings.demoMode;

    const result = await db.transaction(async (trx) => {
      const row = await trx('instance_settings').first();
      if (!row) throw new BadRequestError('Instance settings not found');

      const current = parseSettings(row.settings);
      if (current.setupCompleted) {
        throw new BadRequestError('Setup already completed');
      }

      const updatedSettings = {
        ...current,
        setupCompleted: true,
        setupCompletedAt: new Date().toISOString(),
      };

      await trx('instance_settings')
        .where({ id: row.id })
        .update({
          settings: JSON.stringify(updatedSettings),
          updated_at: new Date(),
        });

      return {
        completed: true,
        completedAt: updatedSettings.setupCompletedAt,
        baseUrl: resolvePublicBaseUrl(),
      };
    });

    if (demoMode) {
      const demoCount = await db('demo_users').count('id as count').first();
      if (Number(demoCount?.count ?? 0) <= 1) {
        await db.seed.run();
      }
    }

    return result;
  }

  async markLegacyComplete() {
    const settings = await getInstanceSettings();
    if (settings.setupCompleted) return;

    const authRow = await db('installed_modules')
      .where({ module_type: 'auth_connector', enabled: true })
      .first();
    const studentRow = await db('installed_modules')
      .where({ module_type: 'student_data_connector', enabled: true })
      .first();

    const row = await readInstanceRow();
    await db('instance_settings')
      .where({ id: row.id })
      .update({
        college_name: (row.college_name as string) || 'Test Instance',
        settings: JSON.stringify({
          ...settings,
          setupCompleted: true,
          setupCompletedAt: new Date().toISOString(),
          activeConnectors: {
            auth: authRow?.module_key as string | undefined,
            student_data: studentRow?.module_key as string | undefined,
          },
        }),
        updated_at: new Date(),
      });
  }
}

export const SetupService = new SetupServiceClass();
