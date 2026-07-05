import { BadRequestError } from '../../app/utils/errors';
import { resolvePublicBaseUrl } from '../../config/publicUrl';
import { AuthConnectorModule, AuthLoginParams } from '../../platform/contracts/auth.contract';
import {
  AuthIntrospectionResult,
  AuthTokenResponse,
  CurrentUser,
  ModuleHealth,
  ModuleTestResult,
  UserRole,
} from '../../platform/types';
import { getDemoUserInfo, introspectDemoToken, issuePasswordToken } from './demo-auth/service';
import { dummyAuthManifest } from './manifest';

const VALID_ROLES: UserRole[] = [
  'student', 'coordinator', 'faculty_supervisor', 'external_supervisor', 'admin', 'auditor',
];

export class DummyAuthConnector implements AuthConnectorModule {
  readonly moduleKey = 'dummy-auth-connector';
  readonly manifest = dummyAuthManifest;

  private apiBaseUrl = '';
  private providerProfile = 'default';
  private enabledCapabilities = new Set<string>(dummyAuthManifest.capabilities);

  setEnabledCapabilities(capabilities: string[]): void {
    this.enabledCapabilities = new Set(capabilities);
  }

  async configure(values: Record<string, unknown>, secrets: Record<string, string>): Promise<void> {
    if (values.providerProfile) this.providerProfile = String(values.providerProfile);
    this.apiBaseUrl = this.resolveApiBaseUrl(secrets.apiBaseUrl);
  }

  private bundledDemoAuthUrl(): string {
    return `${resolvePublicBaseUrl()}/demo-auth`;
  }

  private resolveApiBaseUrl(configured?: string): string {
    const bundledUrl = this.bundledDemoAuthUrl();
    if (!configured) return bundledUrl;

    try {
      const hostname = new URL(configured).hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return bundledUrl;
      }
    } catch {
      return bundledUrl;
    }

    return configured.replace(/\/$/, '');
  }

  private usesBundledDemoAuth(): boolean {
    return this.apiBaseUrl === this.bundledDemoAuthUrl();
  }

  async testConnection(): Promise<ModuleTestResult> {
    if (this.usesBundledDemoAuth()) {
      return {
        moduleKey: this.moduleKey,
        status: 'success',
        contract: 'auth.v1',
        message: 'Bundled demo auth provider active',
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const res = await fetch(`${this.apiBaseUrl}/.well-known/openid-configuration`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return {
        moduleKey: this.moduleKey,
        status: 'success',
        contract: 'auth.v1',
        message: 'Demo auth provider reachable',
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      return {
        moduleKey: this.moduleKey,
        status: 'failure',
        contract: 'auth.v1',
        message: (e as Error).message,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async getCapabilities(): Promise<string[]> {
    return this.manifest.capabilities.filter((c) => this.enabledCapabilities.has(c));
  }

  async getHealth(): Promise<ModuleHealth> {
    const test = await this.testConnection();
    return {
      moduleKey: this.moduleKey,
      status: test.status === 'success' ? 'ok' : 'down',
      message: test.message,
      checkedAt: test.checkedAt,
    };
  }

  async login(params: AuthLoginParams): Promise<AuthTokenResponse> {
    if (!this.enabledCapabilities.has('auth.login')) {
      throw new BadRequestError('Password login feature is disabled for this module');
    }

    if (this.usesBundledDemoAuth()) {
      const data = await issuePasswordToken(
        params.username,
        params.password,
        params.providerProfile ?? this.providerProfile,
      );
      const user = await this.getUserInfo(data.accessToken);
      return {
        accessToken: data.accessToken,
        tokenType: 'Bearer',
        expiresIn: data.expiresIn,
        issuedByModule: this.moduleKey,
        user,
      };
    }

    const res = await fetch(`${this.apiBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grantType: 'password',
        username: params.username,
        password: params.password,
        providerProfile: params.providerProfile ?? this.providerProfile,
      }),
    });
    if (!res.ok) throw new BadRequestError('Invalid credentials');
    const data = await res.json() as { accessToken: string; expiresIn: number; refreshToken?: string };
    const user = await this.getUserInfo(data.accessToken);
    return {
      accessToken: data.accessToken,
      tokenType: 'Bearer',
      expiresIn: data.expiresIn,
      refreshToken: data.refreshToken,
      issuedByModule: this.moduleKey,
      user,
    };
  }

  async introspectToken(token: string): Promise<AuthIntrospectionResult> {
    if (!this.enabledCapabilities.has('auth.introspect')) {
      return { active: false, checkedByModule: this.moduleKey };
    }

    if (this.usesBundledDemoAuth()) {
      const data = await introspectDemoToken(token);
      return {
        active: data.active,
        checkedByModule: this.moduleKey,
        externalUserId: data.sub,
        roles: this.mapExternalRoles(data.roles ?? []),
        expiresAt: data.exp ? new Date(data.exp * 1000).toISOString() : undefined,
      };
    }

    const res = await fetch(`${this.apiBaseUrl}/oauth/introspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json() as { active: boolean; sub?: string; roles?: string[]; exp?: number };
    return {
      active: data.active,
      checkedByModule: this.moduleKey,
      externalUserId: data.sub,
      roles: this.mapExternalRoles(data.roles ?? []),
      expiresAt: data.exp ? new Date(data.exp * 1000).toISOString() : undefined,
    };
  }

  async getUserInfo(token: string): Promise<CurrentUser> {
    if (!this.enabledCapabilities.has('auth.userinfo')) {
      throw new BadRequestError('User info feature is disabled for this module');
    }

    if (this.usesBundledDemoAuth()) {
      return getDemoUserInfo(token);
    }

    const res = await fetch(`${this.apiBaseUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new BadRequestError('Failed to get user info');
    const data = await res.json() as {
      externalUserId: string;
      externalStudentId?: string;
      displayName?: string;
      email?: string;
      roles: string[];
    };
    return {
      externalUserId: data.externalUserId,
      moduleKey: this.moduleKey,
      providerKey: 'dummy-auth',
      displayName: data.displayName,
      email: data.email,
      roles: this.mapExternalRoles(data.roles),
      studentRef: data.externalStudentId ? `student:${data.externalStudentId}` : undefined,
    };
  }

  mapExternalRoles(roles: string[]): UserRole[] {
    if (!this.enabledCapabilities.has('auth.roles')) return [];
    return roles.filter((r): r is UserRole => VALID_ROLES.includes(r as UserRole));
  }
}

export const dummyAuthConnector = new DummyAuthConnector();
