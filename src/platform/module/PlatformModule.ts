import { Router } from 'express';
import { AuthConnectorModule } from '../contracts/auth.contract';
import { StudentDataConnectorModule } from '../contracts/studentData.contract';
import {
  ModuleHealth,
  ModuleManifest,
  ModuleTestResult,
} from '../types';
import { EventBus } from './EventBus';
import { ModuleMigrationConfig } from './ModuleMigrationRunner';
import { serviceRegistry } from './ServiceRegistry';

export type ServiceRegistryApi = typeof serviceRegistry;

/** Runtime contract every module instance must implement */
export interface PlatformModuleInstance {
  readonly moduleKey: string;
  readonly manifest: ModuleManifest;
  configure(values: Record<string, unknown>, secrets: Record<string, string>): Promise<void>;
  testConnection(): Promise<ModuleTestResult>;
  getCapabilities(): Promise<string[]>;
  getHealth(): Promise<ModuleHealth>;
}

export type ConnectorModuleInstance = AuthConnectorModule | StudentDataConnectorModule;

export interface ModuleRouteRegistration {
  path: string;
  router: Router;
}

export interface PlatformModuleDescriptor {
  readonly moduleKey: string;
  readonly manifest: ModuleManifest;
  readonly instance: PlatformModuleInstance;
  onInstall?(): Promise<void>;
  onUninstall?(): Promise<void>;
  onEnable?(): Promise<void>;
  onDisable?(): Promise<void>;
  getDefaultConfig?(): { values: Record<string, unknown>; secrets: Record<string, string> };
  getMigrations?(): ModuleMigrationConfig;
  registerServices?(registry: ServiceRegistryApi, moduleKey: string): void;
  /** Routes mounted when the module is enabled */
  getRoutes?(): ModuleRouteRegistration[];
  registerHooks?(bus: EventBus): () => void;
}

export function isAuthConnector(
  instance: PlatformModuleInstance
): instance is AuthConnectorModule {
  return instance.manifest.moduleType === 'auth_connector';
}

export function isStudentDataConnector(
  instance: PlatformModuleInstance
): instance is StudentDataConnectorModule {
  return instance.manifest.moduleType === 'student_data_connector';
}
