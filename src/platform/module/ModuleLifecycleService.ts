import { ModuleRegistry } from '../registry/ModuleRegistry';

export class ModuleLifecycleService {
  static listAvailable() {
    return ModuleRegistry.listAvailable();
  }

  static install(moduleKey: string) {
    return ModuleRegistry.installModule(moduleKey);
  }

  static uninstall(moduleKey: string) {
    return ModuleRegistry.uninstallModule(moduleKey);
  }

  static enable(moduleKey: string) {
    return ModuleRegistry.enableModule(moduleKey);
  }

  static disable(moduleKey: string) {
    return ModuleRegistry.disableModule(moduleKey);
  }

  static listFeatures(moduleKey: string) {
    return ModuleRegistry.listFeatures(moduleKey);
  }

  static setFeature(moduleKey: string, featureKey: string, enabled: boolean) {
    return ModuleRegistry.setFeature(moduleKey, featureKey, enabled);
  }

  static setFeatures(moduleKey: string, updates: Array<{ featureKey: string; enabled: boolean }>) {
    return ModuleRegistry.setFeatures(moduleKey, updates);
  }
}
