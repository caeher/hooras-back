import db from '../../../database';
import {
  AcademicProfile,
  RuleEvaluationResult,
  RuleEvaluationStatus,
} from '../../../platform/types';
import { refreshStudentProfile } from '../../../core/student-cache/studentCache.service';
import { RulesServiceV1 } from '../../../platform/contracts/services';

interface RuleRow {
  id: string;
  name: string;
  scope: string | Record<string, unknown>;
  required_hours: number;
  category_hours: string | Record<string, number>;
  minimum_progress_percentage?: number;
  required_academic_statuses: string | string[];
  required_course_codes: string | string[];
  active: boolean;
}

function parseJson<T>(val: string | T): T {
  return typeof val === 'string' ? JSON.parse(val) : val;
}

function scopeMatches(scope: Record<string, unknown>, profile: AcademicProfile): boolean {
  if (scope.facultyCode && scope.facultyCode !== profile.facultyCode) return false;
  if (scope.programCode && scope.programCode !== profile.programCode) return false;
  if (scope.degreeLevel && scope.degreeLevel !== profile.degreeLevel) return false;
  if (scope.modality && scope.modality !== profile.modality) return false;
  return true;
}

function mapRule(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    scope: parseJson(row.scope as string),
    requiredHours: Number(row.required_hours),
    categoryHours: parseJson(row.category_hours as string),
    minimumProgressPercentage: row.minimum_progress_percentage
      ? Number(row.minimum_progress_percentage)
      : undefined,
    requiredAcademicStatuses: parseJson(row.required_academic_statuses as string),
    requiredCourseCodes: parseJson(row.required_course_codes as string),
    calendarDuration: row.calendar_duration ? parseJson(row.calendar_duration as string) : undefined,
    active: row.active,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
  };
}

export const rulesService: RulesServiceV1 = {
  async listRules(filters) {
    const rows = await db('requirement_rules').where({ active: true }).orderBy('created_at', 'desc');
    return rows
      .map(mapRule)
      .filter((rule) => {
        const scope = rule.scope as unknown as Record<string, unknown>;
        if (filters.facultyCode && scope.facultyCode !== filters.facultyCode) return false;
        if (filters.programCode && scope.programCode !== filters.programCode) return false;
        if (filters.degreeLevel && scope.degreeLevel !== filters.degreeLevel) return false;
        return true;
      });
  },

  async createRule(input) {
    const [row] = await db('requirement_rules')
      .insert({
        name: input.name,
        scope: JSON.stringify(input.scope ?? {}),
        required_hours: input.requiredHours,
        category_hours: JSON.stringify(input.categoryHours ?? {}),
        minimum_progress_percentage: input.minimumProgressPercentage,
        required_academic_statuses: JSON.stringify(input.requiredAcademicStatuses ?? []),
        required_course_codes: JSON.stringify(input.requiredCourseCodes ?? []),
        calendar_duration: input.calendarDuration ? JSON.stringify(input.calendarDuration) : null,
        active: input.active ?? true,
      })
      .returning('*');
    return mapRule(row);
  },

  async evaluateRules(studentRef, academicProfileInput, _projectId?) {
    const profile = academicProfileInput ?? await refreshStudentProfile(studentRef);
    const rules = await db('requirement_rules').where({ active: true });
    const matched = rules.filter((r) => scopeMatches(parseJson(r.scope), profile));

    if (!matched.length) {
      return {
        status: 'missing_data' as const,
        requiredHours: 0,
        matchedRuleIds: [],
        missingData: ['No matching requirement rules found'],
        explanation: 'No rules configured for this student program/faculty.',
      };
    }

    const matchedRuleIds = matched.map((r) => r.id as string);
    const primary = matched[0] as RuleRow;
    const failedRules: string[] = [];
    const missingData: string[] = [];

    if (!profile.programCode) missingData.push('programCode');
    if (!profile.academicStatus) missingData.push('academicStatus');

    const minProgress = primary.minimum_progress_percentage
      ? Number(primary.minimum_progress_percentage)
      : null;
    if (minProgress != null) {
      if (profile.progressPercentage == null) {
        missingData.push('progressPercentage');
      } else if (profile.progressPercentage < minProgress) {
        failedRules.push(`${primary.name}: minimum progress ${minProgress}% not met`);
      }
    }

    const requiredStatuses = parseJson<string[]>(primary.required_academic_statuses);
    if (requiredStatuses.length && !requiredStatuses.includes(profile.academicStatus)) {
      failedRules.push(`${primary.name}: academic status ${profile.academicStatus} not allowed`);
    }

    const requiredCourses = parseJson<string[]>(primary.required_course_codes);
    const completed = profile.completedCourseCodes ?? [];
    for (const code of requiredCourses) {
      if (!completed.includes(code)) {
        failedRules.push(`${primary.name}: required course ${code} not completed`);
      }
    }

    let status: RuleEvaluationStatus = 'eligible';
    if (missingData.length) status = 'missing_data';
    else if (failedRules.length) status = 'not_eligible';

    const categoryHours = parseJson<Record<string, number>>(primary.category_hours);

    const result: RuleEvaluationResult = {
      status,
      requiredHours: Number(primary.required_hours),
      requiredCategoryHours: categoryHours,
      matchedRuleIds,
      failedRules: failedRules.length ? failedRules : undefined,
      missingData: missingData.length ? missingData : undefined,
      explanation: status === 'eligible'
        ? `Student meets requirements for ${primary.name}.`
        : status === 'missing_data'
          ? 'Required academic data is incomplete.'
          : failedRules.join('; '),
    };

    await db('requirement_evaluations').insert({
      student_ref: studentRef,
      status: result.status,
      required_hours: result.requiredHours,
      result: JSON.stringify(result),
      evaluated_at: new Date(),
    });

    return result;
  },
};
