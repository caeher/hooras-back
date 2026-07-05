import {
  AcademicProfile,
  ModuleTestResult,
  ProviderSchema,
  StudentSearchResult,
} from '../types';
import { PlatformModuleInstance } from '../module/PlatformModule';

export interface StudentDataConnectorContract extends PlatformModuleInstance {
  searchStudents(query: string): Promise<StudentSearchResult[]>;
  getStudentProfile(studentRef: string): Promise<AcademicProfile>;
  getProgramProgress(externalStudentId: string): Promise<Record<string, unknown>>;
  getCompletedCourses(externalStudentId: string): Promise<string[]>;
  getPrograms(): Promise<Record<string, unknown>[]>;
  getSchema(): Promise<ProviderSchema>;
  normalizeStudentData(raw: unknown): AcademicProfile;
}

export interface StudentDataConnectorModule extends StudentDataConnectorContract {
  moduleKey: string;
}
