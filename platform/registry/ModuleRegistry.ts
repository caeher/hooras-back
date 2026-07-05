import { Express } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../database';
import { encrypt, decrypt } from '../../app/utils/crypto';
import { isLocalhostUrl } from '../../config/bundledProvider';
import { BadRequestError, NotFoundError } from '../../app/utils/errors';
import { AuthConnectorModule } from '../contracts/auth.contract';
import { StudentDataConnectorModule } from '../contracts/studentData.contract';
import { platformEventBus } from '../module/EventBus';
import { ModuleRouteManager } from '../module/ModuleRouteManager';
import { runModuleMigrations, rollbackModuleMigrations } from '../module/ModuleMigrationRunner';
import { serviceRegistry } from '../module/ServiceRegistry';
import { sortModuleKeysByDependencies } from './sortModuleKeysByDependencies';
import {
  isAuthConnector,
  isStudentDataConnector,
  PlatformModuleDescriptor,
  PlatformModuleInstance,
} from '../module/PlatformModule';
import {
  ModuleFeatureDefinition,
  ModuleHealth,
  ModuleManifest,
  ModuleStatus,
  ModuleTestResult,
} from '../types';

interface CatalogEntry {
  descriptor: PlatformModuleDescriptor;
}

function parseStoredJson<T>(value: unknown, fallback: T): T {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

class ModuleRegistryClass {
  private catalog = new Map<string, CatalogEntry>();
  private hookUnsubs = new Map<string, () => void>();
  private app: Express | null = null;

  initApp(app: Express): void {
    this.app = app;
    for (const [moduleKey, { descriptor }] of this.catalog) {
      if (descriptor.getRoutes) {
        ModuleRouteManager.registerModuleRoutes(app, moduleKey, descriptor.getRoutes());
      }
    }
  }

  loadCatalog(descriptors: PlatformModuleDescriptor[]): void {
    for (const descriptor of descriptors) {
      this.catalog.set(descriptor.moduleKey, { descriptor });
    }
  }

  async listAvailable() {
    const items = Array.from(this.catalog.values()).map(({ descriptor }) => {
      const manifest = descriptor.manifest;
      return {
        moduleKey: manifest.moduleKey,
        displayName: manifest.displayName,
        version: manifest.version,
        moduleType: manifest.moduleType,
        description: manifest.description,
        dependencies: manifest.dependencies ?? [],
        capabilities: manifest.capabilities,
        features: manifest.features ?? [],
        providedContracts: manifest.providedContracts ?? [],
      };
    });

    const installedKeys = new Set(
      (await db('installed_modules').select('module_key')).map((r) => r.module_key as string)
    );

    return items.map((item) => ({
      ...item,
      installed: installedKeys.has(item.moduleKey),
    }));
  }

  async isInstalled(moduleKey: string): Promise<boolean> {
    const row = await db('installed_modules').where({ module_key: moduleKey }).first();
    return !!row;
  }

  getDescriptor(moduleKey: string): PlatformModuleDescriptor {
    const entry = this.catalog.get(moduleKey);
    if (!entry) throw new NotFoundError(`Module ${moduleKey} not found in catalog`);
    return entry.descriptor;
  }

  getManifest(moduleKey: string): ModuleManifest {
    return this.getDescriptor(moduleKey).manifest;
  }

  getInstance(moduleKey: string): PlatformModuleInstance {
    return this.getDescriptor(moduleKey).instance;
  }

  async listInstalled() {
    const rows = await db('installed_modules').select('*').orderBy('module_key');
    return Promise.all(rows.map((row) => this.mapInstalledModule(row)));
  }

  async getInstalled(moduleKey: string) {
    const row = await db('installed_modules').where({ module_key: moduleKey }).first();
    if (!row) throw new NotFoundError(`Module ${moduleKey} not installed`);
    return this.mapInstalledModule(row);
  }

  private async mapInstalledModule(row: Record<string, unknown>) {
    const moduleKey = row.module_key as string;
    const entry = this.catalog.get(moduleKey);
    let health: ModuleHealth | undefined;
    if (entry && row.enabled) {
      try {
        health = await entry.descriptor.instance.getHealth();
      } catch {
        health = {
          moduleKey,
          status: 'unknown',
          checkedAt: new Date().toISOString(),
        };
      }
    }
    const features = await this.listFeatures(moduleKey);
    return {
      moduleKey,
      displayName: row.display_name,
      version: row.version,
      moduleType: row.module_type,
      status: row.status as ModuleStatus,
      installState: row.install_state ?? 'installed',
      enabled: row.enabled,
      dependencies: typeof row.dependencies === 'string'
        ? JSON.parse(row.dependencies)
        : row.dependencies ?? [],
      capabilities: typeof row.capabilities === 'string'
        ? JSON.parse(row.capabilities)
        : row.capabilities,
      features,
      health,
      installedAt: (row.installed_at as Date)?.toISOString?.() ?? row.installed_at,
      updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
    };
  }

  async installModule(moduleKey: string) {
    const descriptor = this.getDescriptor(moduleKey);
    const existing = await db('installed_modules').where({ module_key: moduleKey }).first();
    if (existing) throw new BadRequestError(`Module ${moduleKey} is already installed`);

    const deps = descriptor.manifest.dependencies ?? [];
    for (const dep of deps) {
      const depRow = await db('installed_modules').where({ module_key: dep }).first();
      if (!depRow) {
        throw new BadRequestError(`Dependency ${dep} must be installed before installing ${moduleKey}`);
      }
    }

    if (descriptor.onInstall) {
      await descriptor.onInstall();
    }

    await db('installed_modules').insert({
      id: uuidv4(),
      module_key: moduleKey,
      display_name: descriptor.manifest.displayName,
      version: descriptor.manifest.version,
      module_type: descriptor.manifest.moduleType,
      status: 'installed',
      install_state: 'installed',
      enabled: false,
      dependencies: JSON.stringify(deps),
      capabilities: JSON.stringify(descriptor.manifest.capabilities),
      installed_at: new Date(),
      updated_at: new Date(),
    });

    await this.seedFeatures(moduleKey, descriptor.manifest.features ?? []);

    const defaults = descriptor.getDefaultConfig?.();
    if (defaults) {
      await this.configureModule(moduleKey, defaults.values, defaults.secrets);
    }

    await this.applyFeatureCapabilities(moduleKey);

    if (descriptor.getMigrations) {
      await runModuleMigrations(descriptor.getMigrations());
    }

    return this.getInstalled(moduleKey);
  }

  private async findModulesDependingOnProvidedServices(moduleKey: string): Promise<string[]> {
    const provided = this.getManifest(moduleKey).providedServices ?? [];
    if (!provided.length) return [];
    const dependents: string[] = [];
    for (const [key, { descriptor }] of this.catalog) {
      if (key === moduleKey) continue;
      const required = descriptor.manifest.requiredServices ?? [];
      if (!required.some((s) => provided.includes(s))) continue;
      const row = await db('installed_modules').where({ module_key: key }).first();
      if (row) dependents.push(key);
    }
    return dependents;
  }

  async uninstallModule(moduleKey: string) {
    const descriptor = this.getDescriptor(moduleKey);
    const row = await db('installed_modules').where({ module_key: moduleKey }).first();
    if (!row) throw new NotFoundError(`Module ${moduleKey} is not installed`);

    const dependents = await db('installed_modules')
      .whereRaw(`dependencies::jsonb @> ?`, [JSON.stringify([moduleKey])]);
    const serviceDependents = await this.findModulesDependingOnProvidedServices(moduleKey);
    const allDependents = [...new Set([...dependents.map((d) => d.module_key as string), ...serviceDependents])];
    if (allDependents.length > 0) {
      throw new BadRequestError(`Cannot uninstall ${moduleKey}: required by ${allDependents.join(', ')}`);
    }

    if (row.enabled) {
      await this.disableModule(moduleKey);
    }

    if (descriptor.onUninstall) {
      await descriptor.onUninstall();
    }

    if (descriptor.getMigrations) {
      try {
        await rollbackModuleMigrations(descriptor.getMigrations());
      } catch (err) {
        console.warn(`[ModuleRegistry] Rollback failed for ${moduleKey}:`, err);
      }
    }

    await db('module_features').where({ module_key: moduleKey }).delete();
    await db('module_configs').where({ module_key: moduleKey }).delete();
    await db('installed_modules').where({ module_key: moduleKey }).delete();

    return { moduleKey, uninstalled: true };
  }

  async enableModule(moduleKey: string) {
    this.getDescriptor(moduleKey);
    const row = await db('installed_modules').where({ module_key: moduleKey }).first();
    if (!row) throw new BadRequestError(`Module ${moduleKey} must be installed before enabling`);

    const descriptor = this.getDescriptor(moduleKey);
    const deps = descriptor.manifest.dependencies ?? [];
    for (const dep of deps) {
      const depRow = await db('installed_modules').where({ module_key: dep, enabled: true }).first();
      if (!depRow) {
        throw new BadRequestError(`Dependency ${dep} must be enabled before enabling ${moduleKey}`);
      }
    }

    const requiredServices = descriptor.manifest.requiredServices ?? [];
    for (const svc of requiredServices) {
      if (!serviceRegistry.has(svc)) {
        throw new BadRequestError(`Required service ${svc} is not available. Enable the providing module first.`);
      }
    }

    await db('installed_modules').where({ module_key: moduleKey }).update({
      enabled: true,
      status: 'enabled',
      updated_at: new Date(),
    });

    await this.activateModule(moduleKey);
    return this.getInstalled(moduleKey);
  }

  async disableModule(moduleKey: string) {
    await db('installed_modules').where({ module_key: moduleKey }).update({
      enabled: false,
      status: 'disabled',
      updated_at: new Date(),
    });
    await this.deactivateModule(moduleKey);
    return this.getInstalled(moduleKey);
  }

  private async activateModule(moduleKey: string) {
    const descriptor = this.getDescriptor(moduleKey);
    ModuleRouteManager.enableRoutes(moduleKey);

    if (descriptor.registerServices) {
      descriptor.registerServices(serviceRegistry, moduleKey);
    }

    if (descriptor.registerHooks) {
      const unsub = descriptor.registerHooks(platformEventBus);
      this.hookUnsubs.set(moduleKey, unsub);
    }

    if (descriptor.onEnable) {
      await descriptor.onEnable();
    }

    await this.reloadInstanceConfig(moduleKey);
    await this.applyFeatureCapabilities(moduleKey);
  }

  private async deactivateModule(moduleKey: string) {
    const descriptor = this.catalog.get(moduleKey)?.descriptor;
    serviceRegistry.revokeModule(moduleKey);
    ModuleRouteManager.disableRoutes(moduleKey);

    const unsub = this.hookUnsubs.get(moduleKey);
    if (unsub) {
      unsub();
      this.hookUnsubs.delete(moduleKey);
    }
    platformEventBus.clearModule(moduleKey);

    if (descriptor?.onDisable) {
      await descriptor.onDisable();
    }
  }

  async getConfig(moduleKey: string) {
    const row = await db('module_configs').where({ module_key: moduleKey }).first();
    if (!row) {
      return { moduleKey, configured: false, values: {}, secretNames: [] };
    }
    return {
      moduleKey,
      configured: true,
      values: typeof row.values === 'string' ? JSON.parse(row.values) : row.values ?? {},
      secretNames: row.secret_names
        ? typeof row.secret_names === 'string'
          ? JSON.parse(row.secret_names)
          : row.secret_names
        : [],
      updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
    };
  }

  async configureModule(
    moduleKey: string,
    values: Record<string, unknown> = {},
    secrets: Record<string, string> = {}
  ) {
    this.getDescriptor(moduleKey);

    const encryptedSecrets: Record<string, string> = {};
    for (const [key, value] of Object.entries(secrets)) {
      encryptedSecrets[key] = encrypt(value);
    }

    const existing = await db('module_configs').where({ module_key: moduleKey }).first();
    const secretNames = Object.keys(secrets);
    const mergedSecrets = existing?.encrypted_secrets
      ? {
          ...(typeof existing.encrypted_secrets === 'string'
            ? JSON.parse(existing.encrypted_secrets)
            : existing.encrypted_secrets),
          ...encryptedSecrets,
        }
      : encryptedSecrets;

    if (existing) {
      await db('module_configs').where({ module_key: moduleKey }).update({
        values: JSON.stringify({
          ...parseStoredJson<Record<string, unknown>>(existing.values, {}),
          ...values,
        }),
        encrypted_secrets: JSON.stringify(mergedSecrets),
        secret_names: JSON.stringify([
          ...new Set([
            ...secretNames,
            ...parseStoredJson<string[]>(existing.secret_names, []),
          ]),
        ]),
        updated_at: new Date(),
      });
    } else {
      const installed = await db('installed_modules').where({ module_key: moduleKey }).first();
      if (!installed) {
        throw new BadRequestError(`Module ${moduleKey} must be installed before configuring`);
      }
      await db('module_configs').insert({
        id: uuidv4(),
        module_key: moduleKey,
        values: JSON.stringify(values),
        encrypted_secrets: JSON.stringify(encryptedSecrets),
        secret_names: JSON.stringify(secretNames),
        updated_at: new Date(),
      });
    }

    await this.reloadInstanceConfig(moduleKey);
    return this.getConfig(moduleKey);
  }

  private async reloadInstanceConfig(moduleKey: string) {
    const descriptor = this.getDescriptor(moduleKey);
    const config = await db('module_configs').where({ module_key: moduleKey }).first();
    if (!config) return;

    const values = typeof config.values === 'string' ? JSON.parse(config.values) : config.values ?? {};
    const enc = config.encrypted_secrets
      ? typeof config.encrypted_secrets === 'string'
        ? JSON.parse(config.encrypted_secrets)
        : config.encrypted_secrets
      : {};
    const secrets: Record<string, string> = {};
    for (const [k, v] of Object.entries(enc)) {
      try {
        secrets[k] = decrypt(v as string);
      } catch {
        /* skip invalid */
      }
    }
    await descriptor.instance.configure(values, secrets);
  }

  async testModule(moduleKey: string): Promise<ModuleTestResult> {
    return this.getInstance(moduleKey).testConnection();
  }

  async getModuleHealth(moduleKey: string): Promise<ModuleHealth> {
    return this.getInstance(moduleKey).getHealth();
  }

  async getActiveAuthConnector(): Promise<AuthConnectorModule> {
    const row = await db('installed_modules')
      .where({ module_type: 'auth_connector', enabled: true })
      .first();
    if (!row) throw new BadRequestError('No auth connector module is enabled');
    const instance = this.getInstance(row.module_key as string);
    if (!isAuthConnector(instance)) {
      throw new BadRequestError('Auth connector module not registered');
    }
    return instance;
  }

  async getActiveStudentDataConnector(): Promise<StudentDataConnectorModule> {
    const row = await db('installed_modules')
      .where({ module_type: 'student_data_connector', enabled: true })
      .first();
    if (!row) throw new BadRequestError('No student-data connector module is enabled');
    const instance = this.getInstance(row.module_key as string);
    if (!isStudentDataConnector(instance)) {
      throw new BadRequestError('Student-data connector module not registered');
    }
    return instance;
  }

  async getCapabilities() {
    const modules = await this.listInstalled();
    const providers = await db('provider_connections').select('*');
    return {
      modules: await Promise.all(modules.map(async (m) => ({
        key: m.moduleKey,
        enabled: m.enabled,
        version: m.version,
        capabilities: m.enabled
          ? await this.getInstance(m.moduleKey as string).getCapabilities()
          : [],
      }))),
      providers: providers.map((p) => ({
        moduleKey: p.module_key,
        providerKey: p.provider_key,
        providerType: p.provider_type,
        status: p.enabled ? (p.last_health_status === 'ok' ? 'connected' : 'configured') : 'disabled',
        capabilities: p.capabilities
          ? typeof p.capabilities === 'string'
            ? JSON.parse(p.capabilities)
            : p.capabilities
          : [],
      })),
    };
  }

  async loadModuleConfigs(): Promise<void> {
    const rows = await db('installed_modules').where({ enabled: true });
    for (const row of rows) {
      if (this.catalog.has(row.module_key as string)) {
        await this.syncStaleBundledModuleUrls(row.module_key as string);
        await this.reloadInstanceConfig(row.module_key as string);
        await this.applyFeatureCapabilities(row.module_key as string);
      }
    }
  }

  async ensureDefaultModulesInstalled(moduleKeys: string[]): Promise<void> {
    const orderedKeys = sortModuleKeysByDependencies(moduleKeys, (moduleKey) => {
      const descriptor = this.getDescriptor(moduleKey);
      const deps = new Set(descriptor.manifest.dependencies ?? []);

      for (const service of descriptor.manifest.requiredServices ?? []) {
        for (const [providerKey, { descriptor: provider }] of this.catalog) {
          if (provider.manifest.providedServices?.includes(service)) {
            deps.add(providerKey);
            break;
          }
        }
      }

      return Array.from(deps);
    });

    for (const moduleKey of orderedKeys) {
      const existing = await db('installed_modules').where({ module_key: moduleKey }).first();
      if (!existing) {
        await this.installModule(moduleKey);
        await this.enableModule(moduleKey);
      } else {
        await this.ensureFeaturesSeeded(moduleKey);
        if (!existing.enabled) {
          await this.enableModule(moduleKey);
        } else {
          ModuleRouteManager.enableRoutes(moduleKey);
          await this.activateModule(moduleKey);
        }
        const config = await db('module_configs').where({ module_key: moduleKey }).first();
        if (!config) {
          const defaults = this.getDescriptor(moduleKey).getDefaultConfig?.();
          if (defaults) {
            await this.configureModule(moduleKey, defaults.values, defaults.secrets);
          }
        } else {
          await this.syncStaleBundledModuleUrls(moduleKey);
        }
      }
    }
  }

  private async syncStaleBundledModuleUrls(moduleKey: string): Promise<void> {
    const descriptor = this.catalog.get(moduleKey)?.descriptor;
    const defaults = descriptor?.getDefaultConfig?.();
    if (!defaults?.secrets?.apiBaseUrl) return;

    const config = await db('module_configs').where({ module_key: moduleKey }).first();
    if (!config?.encrypted_secrets) return;

    const enc = typeof config.encrypted_secrets === 'string'
      ? JSON.parse(config.encrypted_secrets)
      : config.encrypted_secrets;

    const storedApiBaseUrl = enc.apiBaseUrl as string | undefined;
    if (!storedApiBaseUrl) return;

    let decrypted = '';
    try {
      decrypted = decrypt(storedApiBaseUrl);
    } catch {
      return;
    }

    if (!isLocalhostUrl(decrypted)) return;
    if (decrypted === defaults.secrets.apiBaseUrl) return;

    await this.configureModule(moduleKey, defaults.values ?? {}, defaults.secrets);
  }

  private async ensureFeaturesSeeded(moduleKey: string) {
    const manifest = this.getManifest(moduleKey);
    const features = manifest.features ?? [];
    for (const feature of features) {
      const existing = await db('module_features')
        .where({ module_key: moduleKey, feature_key: feature.key })
        .first();
      if (!existing) {
        await db('module_features').insert({
          id: uuidv4(),
          module_key: moduleKey,
          feature_key: feature.key,
          enabled: feature.default,
          updated_at: new Date(),
        });
      }
    }
    await this.applyFeatureCapabilities(moduleKey);
  }

  private async seedFeatures(moduleKey: string, features: ModuleFeatureDefinition[]) {
    for (const feature of features) {
      await db('module_features').insert({
        id: uuidv4(),
        module_key: moduleKey,
        feature_key: feature.key,
        enabled: feature.default,
        updated_at: new Date(),
      });
    }
  }

  async listFeatures(moduleKey: string) {
    const rows = await db('module_features').where({ module_key: moduleKey });
    const manifest = this.catalog.get(moduleKey)?.descriptor.manifest;
    return rows.map((row) => {
      const def = manifest?.features?.find((f: { key: string }) => f.key === row.feature_key);
      return {
        featureKey: row.feature_key,
        name: def?.name ?? row.feature_key,
        description: def?.description,
        enabled: row.enabled,
        capabilities: def?.capabilities ?? [],
      };
    });
  }

  async setFeature(moduleKey: string, featureKey: string, enabled: boolean) {
    const manifest = this.getManifest(moduleKey);
    const def = manifest.features?.find((f) => f.key === featureKey);
    if (!def) throw new NotFoundError(`Feature ${featureKey} not found on module ${moduleKey}`);

    const row = await db('module_features')
      .where({ module_key: moduleKey, feature_key: featureKey })
      .first();
    if (!row) throw new NotFoundError(`Feature ${featureKey} not installed`);

    await db('module_features')
      .where({ module_key: moduleKey, feature_key: featureKey })
      .update({ enabled, updated_at: new Date() });

    await this.applyFeatureCapabilities(moduleKey);
    return this.listFeatures(moduleKey);
  }

  async setFeatures(moduleKey: string, updates: Array<{ featureKey: string; enabled: boolean }>) {
    for (const update of updates) {
      await this.setFeature(moduleKey, update.featureKey, update.enabled);
    }
    return this.listFeatures(moduleKey);
  }

  private async applyFeatureCapabilities(moduleKey: string) {
    const instance = this.getInstance(moduleKey);
    const manifest = this.getManifest(moduleKey);
    const featureRows = await db('module_features').where({ module_key: moduleKey });

    const enabledCaps = new Set<string>();
    if (!manifest.features || manifest.features.length === 0) {
      manifest.capabilities.forEach((c) => enabledCaps.add(c));
    } else {
      for (const row of featureRows) {
        if (!row.enabled) continue;
        const def = manifest.features.find((f) => f.key === row.feature_key);
        if (def?.capabilities) {
          def.capabilities.forEach((c) => enabledCaps.add(c));
        }
      }
    }

    if ('setEnabledCapabilities' in instance && typeof instance.setEnabledCapabilities === 'function') {
      (instance as PlatformModuleInstance & { setEnabledCapabilities: (c: string[]) => void })
        .setEnabledCapabilities(Array.from(enabledCaps));
    }

    await db('installed_modules').where({ module_key: moduleKey }).update({
      capabilities: JSON.stringify(Array.from(enabledCaps)),
      updated_at: new Date(),
    });
  }
}

export const ModuleRegistry = new ModuleRegistryClass();
