import { ModuleHealth, ModuleManifest, ModuleTestResult } from '../types';
import { PlatformModuleInstance } from './PlatformModule';

export function createBaseDomainModule(manifest: ModuleManifest): PlatformModuleInstance {
  return {
    moduleKey: manifest.moduleKey,
    manifest,
    async configure() {},
    async testConnection(): Promise<ModuleTestResult> {
      return {
        moduleKey: manifest.moduleKey,
        status: 'success',
        message: 'Domain module ready',
        checkedAt: new Date().toISOString(),
      };
    },
    async getCapabilities(): Promise<string[]> {
      return manifest.capabilities;
    },
    async getHealth(): Promise<ModuleHealth> {
      return {
        moduleKey: manifest.moduleKey,
        status: 'ok',
        checkedAt: new Date().toISOString(),
      };
    },
  };
}
