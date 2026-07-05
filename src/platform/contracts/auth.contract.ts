import {
  AuthIntrospectionResult,
  AuthTokenResponse,
  CurrentUser,
  ModuleHealth,
  ModuleTestResult,
  UserRole,
} from '../types';
import { PlatformModuleInstance } from '../module/PlatformModule';

export interface AuthLoginParams {
  username: string;
  password: string;
  providerProfile?: string;
}

export interface AuthConnectorContract extends PlatformModuleInstance {
  login(params: AuthLoginParams): Promise<AuthTokenResponse>;
  introspectToken(token: string): Promise<AuthIntrospectionResult>;
  getUserInfo(token: string): Promise<CurrentUser>;
  mapExternalRoles(roles: string[]): UserRole[];
  logout?(token: string): Promise<void>;
}

export interface AuthConnectorModule extends AuthConnectorContract {
  moduleKey: string;
}
