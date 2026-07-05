import { BadRequestError, NotFoundError } from '../../app/utils/errors';
import { StudentDataConnectorModule } from '../../platform/contracts/studentData.contract';
import {
  AcademicProfile,
  ModuleHealth,
  ModuleTestResult,
  ProviderSchema,
  StudentSearchResult,
} from '../../platform/types';
import { buildAcademicProfile } from './demo-student-data/profiles';
import { dummyStudentDataManifest } from './manifest';

export class DummyStudentDataConnector implements StudentDataConnectorModule {
  readonly moduleKey = 'dummy-student-data-connector';
  readonly manifest = dummyStudentDataManifest;

  private apiBaseUrl = '';
  private providerProfile = 'progress_percentage';
  private enabledCapabilities = new Set<string>(dummyStudentDataManifest.capabilities);

  setEnabledCapabilities(capabilities: string[]): void {
    this.enabledCapabilities = new Set(capabilities);
  }

  async configure(values: Record<string, unknown>, secrets: Record<string, string>): Promise<void> {
    if (secrets.apiBaseUrl) this.apiBaseUrl = secrets.apiBaseUrl;
    if (values.providerProfile) this.providerProfile = String(values.providerProfile);
  }

  async testConnection(): Promise<ModuleTestResult> {
    try {
      const url = `${this.apiBaseUrl}/schema?providerProfile=${this.providerProfile}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return {
        moduleKey: this.moduleKey,
        status: 'success',
        contract: 'student_data.v1',
        message: 'Demo student-data provider reachable',
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      return {
        moduleKey: this.moduleKey,
        status: 'failure',
        contract: 'student_data.v1',
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

  private profileParam(): string {
    return `providerProfile=${encodeURIComponent(this.providerProfile)}`;
  }

  private assertCapability(capability: string): void {
    if (!this.enabledCapabilities.has(capability)) {
      throw new BadRequestError(`Capability ${capability} is disabled for this module`);
    }
  }

  async searchStudents(query: string): Promise<StudentSearchResult[]> {
    this.assertCapability('student.search');
    const url = `${this.apiBaseUrl}/students?query=${encodeURIComponent(query)}&${this.profileParam()}`;
    const res = await fetch(url);
    const data = await res.json() as Array<{ externalStudentId: string; displayName: string; email?: string; raw?: unknown }>;
    return data.map((s) => {
      const profile = s.raw ? buildAcademicProfile(s.externalStudentId, this.providerProfile, s.raw) : null;
      return {
        studentRef: `student:${s.externalStudentId}`,
        externalStudentId: s.externalStudentId,
        displayName: s.displayName,
        email: s.email,
        programCode: profile?.programCode,
        programName: profile?.programName,
        resolvedByModule: this.moduleKey,
      };
    });
  }

  async getStudentProfile(studentRef: string): Promise<AcademicProfile> {
    this.assertCapability('student.profile.read');
    const externalStudentId = studentRef.replace(/^student:/, '');
    const url = `${this.apiBaseUrl}/students/${externalStudentId}/academic-profile?${this.profileParam()}`;
    const res = await fetch(url);
    if (!res.ok) throw new NotFoundError('Student not found');
    const profile = await res.json() as AcademicProfile;
    return { ...profile, studentRef };
  }

  async getProgramProgress(externalStudentId: string): Promise<Record<string, unknown>> {
    this.assertCapability('student.progress.read');
    const url = `${this.apiBaseUrl}/students/${externalStudentId}/program-progress?${this.profileParam()}`;
    const res = await fetch(url);
    if (!res.ok) throw new NotFoundError('Student not found');
    return res.json() as Promise<Record<string, unknown>>;
  }

  async getCompletedCourses(externalStudentId: string): Promise<string[]> {
    const profile = await this.getStudentProfile(`student:${externalStudentId}`);
    return profile.completedCourseCodes ?? [];
  }

  async getPrograms(): Promise<Record<string, unknown>[]> {
    this.assertCapability('student.programs.read');
    const url = `${this.apiBaseUrl}/programs?${this.profileParam()}`;
    const res = await fetch(url);
    return res.json() as Promise<Record<string, unknown>[]>;
  }

  async getSchema(): Promise<ProviderSchema> {
    this.assertCapability('student.schema.read');
    const url = `${this.apiBaseUrl}/schema?${this.profileParam()}`;
    const res = await fetch(url);
    return res.json() as Promise<ProviderSchema>;
  }

  normalizeStudentData(raw: unknown): AcademicProfile {
    const externalId = (raw as Record<string, unknown>)?.externalStudentId as string
      ?? (raw as Record<string, unknown>)?.id as string
      ?? 'unknown';
    return buildAcademicProfile(externalId, this.providerProfile, raw);
  }
}

export const dummyStudentDataConnector = new DummyStudentDataConnector();
