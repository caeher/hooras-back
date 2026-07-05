import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { PlatformModuleDescriptor } from './PlatformModule';

const DEFAULT_MODULES_DIR = path.join(process.cwd(), 'src', 'modules');

export class ModuleLoader {
  /**
   * Discover module descriptors from a directory.
   * Each subdirectory with an index.ts/js exporting `default` as PlatformModuleDescriptor is loaded.
   */
  static async loadFromPath(modulesDir: string = DEFAULT_MODULES_DIR): Promise<PlatformModuleDescriptor[]> {
    if (!fs.existsSync(modulesDir)) {
      return [];
    }

    const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    const descriptors: PlatformModuleDescriptor[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const indexTs = path.join(modulesDir, entry.name, 'index.ts');
      const indexJs = path.join(modulesDir, entry.name, 'index.js');
      const indexPath = fs.existsSync(indexTs) ? indexTs : fs.existsSync(indexJs) ? indexJs : null;
      if (!indexPath) continue;

      try {
        const loaded = await import(pathToFileURL(indexPath).href);
        const descriptor = (loaded.default ?? loaded.module) as PlatformModuleDescriptor;
        if (!descriptor?.moduleKey || !descriptor?.instance || !descriptor?.manifest) {
          console.warn(`[ModuleLoader] Skipping ${entry.name}: invalid descriptor export`);
          continue;
        }
        descriptors.push(descriptor);
      } catch (err) {
        console.error(`[ModuleLoader] Failed to load module ${entry.name}:`, err);
      }
    }

    return descriptors.sort((a, b) => a.moduleKey.localeCompare(b.moduleKey));
  }

  static async discoverAndRegister(
    register: (descriptor: PlatformModuleDescriptor) => void,
    modulesDir?: string
  ): Promise<PlatformModuleDescriptor[]> {
    const descriptors = await this.loadFromPath(modulesDir);
    for (const descriptor of descriptors) {
      register(descriptor);
    }
    return descriptors;
  }
}
