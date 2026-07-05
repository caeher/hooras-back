import {
  RuleEvaluationResult,
  StudentProfile,
} from '../../../platform/types';
import {
  getCachedProfile,
  refreshStudentProfile as refreshCachedProfile,
  invalidateStudentCache,
} from '../../../core/student-cache/studentCache.service';
import { getService } from '../../../platform/module/ServiceRegistry';
import {
  RULES_V1,
  RulesServiceV1,
  HOURS_V1,
  HoursServiceV1,
  DOCUMENTS_V1,
  DocumentsServiceV1,
  StudentProfileServiceV1,
} from '../../../platform/contracts/services';

function mapDocumentRequirement(row: Record<string, unknown>) {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    required: row.required,
    appliesTo: typeof row.applies_to === 'string' ? JSON.parse(row.applies_to) : row.applies_to,
    allowedFileTypes: typeof row.allowed_file_types === 'string'
      ? JSON.parse(row.allowed_file_types)
      : row.allowed_file_types,
    maxFileSizeMb: row.max_file_size_mb,
    requiresApproval: row.requires_approval,
    templateId: row.template_id,
  };
}

async function buildStudentProfile(
  studentRef: string,
  eligibility: RuleEvaluationResult
): Promise<StudentProfile> {
  let academicProfile = await getCachedProfile(studentRef);
  if (!academicProfile) {
    academicProfile = await refreshCachedProfile(studentRef);
  }

  const hoursService = getService<HoursServiceV1>(HOURS_V1);
  const documentsService = getService<DocumentsServiceV1>(DOCUMENTS_V1);

  const completedHours = await hoursService.getStudentHours(studentRef);
  const remainingHours = Math.max(0, eligibility.requiredHours - completedHours);
  const docReqs = await documentsService.listRequirements();

  return {
    studentRef,
    academicProfile,
    eligibility,
    completedHours,
    remainingHours,
    requiredDocuments: docReqs,
    recommendedProjectCategories: Object.keys(eligibility.requiredCategoryHours ?? {}),
  };
}

export const studentProfileService: StudentProfileServiceV1 = {
  async buildProfile(studentRef) {
    const rulesService = getService<RulesServiceV1>(RULES_V1);
    const eligibility = await rulesService.evaluateRules(studentRef);
    return buildStudentProfile(studentRef, eligibility);
  },

  async refreshProfile(studentRef) {
    return refreshCachedProfile(studentRef);
  },

  async invalidateCache(externalStudentId) {
    await invalidateStudentCache(externalStudentId);
  },
};

export { buildStudentProfile };
