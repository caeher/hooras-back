import { BadRequestError } from '../../app/utils/errors';

interface ServiceEntry {
  moduleKey: string;
  service: unknown;
}

class ServiceRegistryClass {
  private services = new Map<string, ServiceEntry>();

  provide(contract: string, moduleKey: string, service: unknown): void {
    this.services.set(contract, { moduleKey, service });
  }

  get<T>(contract: string): T {
    const entry = this.services.get(contract);
    if (!entry) {
      throw new BadRequestError(`Service contract ${contract} is not available`);
    }
    return entry.service as T;
  }

  has(contract: string): boolean {
    return this.services.has(contract);
  }

  getProviderModule(contract: string): string | undefined {
    return this.services.get(contract)?.moduleKey;
  }

  revokeModule(moduleKey: string): void {
    for (const [contract, entry] of this.services) {
      if (entry.moduleKey === moduleKey) {
        this.services.delete(contract);
      }
    }
  }

  listContracts(): string[] {
    return Array.from(this.services.keys());
  }
}

export const serviceRegistry = new ServiceRegistryClass();

export function getService<T>(contract: string): T {
  return serviceRegistry.get<T>(contract);
}
