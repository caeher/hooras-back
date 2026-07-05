export type UserRole =
  | 'student'
  | 'coordinator'
  | 'faculty_supervisor'
  | 'external_supervisor'
  | 'admin'
  | 'auditor';

export type ModuleType =
  | 'auth_connector'
  | 'student_data_connector'
  | 'notification_connector'
  | 'workflow_connector'
  | 'scraper_connector'
  | 'document_template'
  | 'reporting_extension'
  | 'rules_extension'
  | 'projects'
  | 'applications'
  | 'assignments'
  | 'hours'
  | 'documents'
  | 'certificates'
  | 'student_profile';

export type ModuleStatus = 'installed' | 'enabled' | 'disabled' | 'misconfigured' | 'failing';

export type ModuleInstallState = 'available' | 'installed' | 'uninstalled';

export interface ModuleFeatureDefinition {
  key: string;
  name: string;
  description?: string;
  default: boolean;
  /** Capability strings gated by this feature toggle */
  capabilities?: string[];
}

export type ProviderType = 'auth' | 'student_data' | 'email' | 'workflow' | 'scraper';

export type AcademicStatus = 'active' | 'egresado' | 'graduate_candidate' | 'inactive' | 'unknown';

export type DegreeLevel =
  | 'technical'
  | 'teaching'
  | 'bachelor'
  | 'engineering'
  | 'architecture'
  | 'master'
  | 'doctorate'
  | 'other';

export type Modality = 'onsite' | 'online' | 'hybrid' | 'other';

export type RuleEvaluationStatus = 'eligible' | 'not_eligible' | 'manual_review' | 'missing_data';

export type ProjectStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'accepting_applications'
  | 'in_execution'
  | 'closed'
  | 'archived'
  | 'rejected'
  | 'cancelled'
  | 'suspended';

export type ProjectSourceType = 'college_created' | 'scraped';

export type ApplicationStatus = 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'waitlisted';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type AssignmentStatus = 'active' | 'completed' | 'cancelled' | 'suspended';

export type ImportRunStatus = 'queued' | 'running' | 'completed' | 'failed';

export type ImportResultStatus = 'pending_review' | 'approved' | 'rejected' | 'duplicate';

export type HourCategory =
  | 'disciplinary'
  | 'environmental'
  | 'community'
  | 'research'
  | 'administrative'
  | 'other';

export interface CurrentUser {
  externalUserId: string;
  moduleKey: string;
  providerKey: string;
  displayName?: string;
  email?: string;
  roles: UserRole[];
  studentRef?: string;
}

export interface AcademicProfile {
  studentRef: string;
  externalStudentId: string;
  displayName?: string;
  email?: string;
  facultyCode?: string;
  facultyName?: string;
  programCode: string;
  programName: string;
  degreeLevel?: DegreeLevel;
  modality?: Modality;
  cohort?: string;
  academicStatus: AcademicStatus;
  approvedCredits?: number;
  totalCredits?: number;
  approvedSubjects?: number;
  totalSubjects?: number;
  progressPercentage?: number;
  gpa?: number;
  completedCourseCodes?: string[];
  skills?: string[];
  lastSyncedAt?: string;
}

export interface RuleEvaluationResult {
  status: RuleEvaluationStatus;
  requiredHours: number;
  requiredCategoryHours?: Record<string, number>;
  matchedRuleIds: string[];
  failedRules?: string[];
  missingData?: string[];
  explanation?: string;
}

export interface StudentProfile {
  studentRef: string;
  academicProfile: AcademicProfile;
  eligibility: RuleEvaluationResult;
  completedHours?: number;
  remainingHours?: number;
  requiredDocuments?: unknown[];
  recommendedProjectCategories?: string[];
}

export interface ModuleManifest {
  moduleKey: string;
  displayName: string;
  version: string;
  moduleType: ModuleType;
  description?: string;
  author?: string;
  license?: string;
  platformVersion?: string;
  capabilities: string[];
  /** Module keys that must be installed and enabled before this module can be enabled */
  dependencies?: string[];
  /** Service contracts required from other enabled modules */
  requiredServices?: string[];
  /** Service contracts this module provides when enabled */
  providedServices?: string[];
  /** Toggleable features within the module */
  features?: ModuleFeatureDefinition[];
  providedContracts?: string[];
  requiredContracts?: string[];
  requiredSecrets?: string[];
  configurationSchema?: Record<string, unknown>;
  permissions?: string[];
  webhookSubscriptions?: string[];
  eventSubscriptions?: string[];
}

export interface ModuleHealth {
  moduleKey: string;
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  message?: string;
  checkedAt: string;
}

export interface ModuleTestResult {
  moduleKey: string;
  status: 'success' | 'failure';
  contract?: string;
  message?: string;
  details?: Record<string, unknown>;
  checkedAt: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken?: string;
  issuedByModule: string;
  user?: CurrentUser;
}

export interface AuthIntrospectionResult {
  active: boolean;
  checkedByModule: string;
  externalUserId?: string;
  roles?: UserRole[];
  expiresAt?: string;
}

export interface StudentSearchResult {
  studentRef: string;
  externalStudentId: string;
  displayName: string;
  email?: string;
  programCode?: string;
  programName?: string;
  resolvedByModule: string;
}

export interface ProviderSchema {
  providerKey: string;
  providerProfile?: string;
  fields: Array<{
    path: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
}

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
      token?: string;
    }
  }
}
