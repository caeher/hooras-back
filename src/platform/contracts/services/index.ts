import {
  AcademicProfile,
  RuleEvaluationResult,
} from '../../types';

export const NOTIFICATIONS_V1 = 'notifications.v1';
export const RULES_V1 = 'rules.v1';
export const PROJECTS_V1 = 'projects.v1';
export const ASSIGNMENTS_V1 = 'assignments.v1';
export const HOURS_V1 = 'hours.v1';
export const DOCUMENTS_V1 = 'documents.v1';
export const STUDENT_PROFILE_V1 = 'student-profile.v1';

export type NotificationEvent =
  | 'application_submitted'
  | 'application_approved'
  | 'application_rejected'
  | 'missing_document'
  | 'document_approved'
  | 'document_rejected'
  | 'hours_approved'
  | 'hours_rejected'
  | 'project_deadline_approaching'
  | 'final_report_required'
  | 'certificate_generated';

export interface NotificationsServiceV1 {
  send(eventType: NotificationEvent, recipient: string, payload?: Record<string, unknown>): Promise<string>;
}

export interface RulesServiceV1 {
  listRules(filters: { facultyCode?: string; programCode?: string; degreeLevel?: string }): Promise<unknown[]>;
  createRule(input: Record<string, unknown>): Promise<unknown>;
  evaluateRules(studentRef: string, academicProfile?: AcademicProfile, projectId?: string): Promise<RuleEvaluationResult>;
}

export interface ProjectsServiceV1 {
  getById(projectId: string): Promise<Record<string, unknown> | null>;
  createFromImport(extracted: Record<string, unknown>, sourceUrl: string, confidence?: number): Promise<Record<string, unknown>>;
}

export interface AssignmentsServiceV1 {
  createFromApplication(projectId: string, studentRef: string): Promise<Record<string, unknown>>;
  listByStudent(studentRef: string): Promise<Array<{ id: string }>>;
}

export interface HoursServiceV1 {
  getStudentHours(studentRef: string): Promise<number>;
}

export interface DocumentsServiceV1 {
  listRequirements(): Promise<unknown[]>;
  createCertificateDocument(studentRef: string, assignmentId?: string, verificationCode?: string): Promise<string>;
}

export interface StudentProfileServiceV1 {
  buildProfile(studentRef: string): Promise<unknown>;
  refreshProfile(studentRef: string): Promise<AcademicProfile>;
  invalidateCache(externalStudentId: string): Promise<void>;
}
