import { applyFieldMappings, normalizeEnum } from '../../../app/utils/mapper';
import { AcademicProfile, AcademicStatus, DegreeLevel, Modality } from '../../../platform/types';

export interface ProfileMappingConfig {
  mappings: Record<string, string>;
  required: string[];
  statusMap: Record<string, AcademicStatus>;
}

export const PROFILE_MAPPINGS: Record<string, ProfileMappingConfig> = {
  progress_percentage: {
    mappings: {
      externalStudentId: '$.id',
      displayName: '$.name',
      email: '$.email',
      facultyCode: '$.faculty.code',
      facultyName: '$.faculty.name',
      programCode: '$.career.code',
      programName: '$.career.name',
      degreeLevel: '$.degreeLevel',
      modality: '$.modality',
      cohort: '$.cohort',
      academicStatus: '$.academic.status',
      progressPercentage: '$.academic.progress',
      gpa: '$.academic.gpa',
      completedCourseCodes: '$.courses.completed',
    },
    required: ['externalStudentId', 'programCode', 'programName', 'academicStatus'],
    statusMap: { active: 'active', egresado: 'egresado', graduate_candidate: 'graduate_candidate', inactive: 'inactive' },
  },
  credits_based: {
    mappings: {
      externalStudentId: '$.studentId',
      displayName: '$.fullName',
      email: '$.mail',
      facultyCode: '$.dept.id',
      facultyName: '$.dept.label',
      programCode: '$.program.id',
      programName: '$.program.title',
      degreeLevel: '$.level',
      modality: '$.mode',
      cohort: '$.batch',
      academicStatus: '$.statusCode',
      approvedCredits: '$.credits.approved',
      totalCredits: '$.credits.total',
      completedCourseCodes: '$.finishedCourses',
    },
    required: ['externalStudentId', 'programCode', 'programName', 'academicStatus'],
    statusMap: { active: 'active', egresado: 'egresado', graduate: 'egresado' },
  },
  subjects_based: {
    mappings: {
      externalStudentId: '$.carnet',
      displayName: '$.nombre',
      email: '$.correo',
      facultyCode: '$.facultad.codigo',
      facultyName: '$.facultad.nombre',
      programCode: '$.carrera.codigo',
      programName: '$.carrera.nombre',
      degreeLevel: '$.grado',
      modality: '$.modalidad',
      cohort: '$.promocion',
      academicStatus: '$.estado',
      approvedSubjects: '$.materias.aprobadas',
      totalSubjects: '$.materias.total',
      completedCourseCodes: '$.asignaturasCompletadas',
    },
    required: ['externalStudentId', 'programCode', 'programName', 'academicStatus'],
    statusMap: { active: 'active', egresado: 'egresado', graduate_candidate: 'graduate_candidate' },
  },
  status_code_based: {
    mappings: {
      externalStudentId: '$.id',
      displayName: '$.name',
      email: '$.email',
      programCode: '$.career.code',
      programName: '$.career.name',
      academicStatus: '$.status',
      progressPercentage: '$.academic.progress',
    },
    required: ['externalStudentId', 'programCode', 'programName', 'academicStatus'],
    statusMap: { ACT: 'active', EGR: 'egresado', GC: 'graduate_candidate' },
  },
};

const DEGREE_MAP: Record<string, DegreeLevel> = {
  technical: 'technical', teaching: 'teaching', bachelor: 'bachelor',
  engineering: 'engineering', architecture: 'architecture', master: 'master', doctorate: 'doctorate',
};

const MODALITY_MAP: Record<string, Modality> = {
  onsite: 'onsite', online: 'online', hybrid: 'hybrid', remote: 'online',
};

export function buildAcademicProfile(
  externalStudentId: string,
  providerProfile: string,
  raw: unknown
): AcademicProfile {
  const config = PROFILE_MAPPINGS[providerProfile] ?? PROFILE_MAPPINGS.progress_percentage;
  const { data } = applyFieldMappings(raw, config.mappings, config.required);

  let completedCourseCodes: string[] = [];
  const courses = data.completedCourseCodes;
  if (Array.isArray(courses)) {
    completedCourseCodes = courses.map((c) =>
      typeof c === 'string' ? c : (c as { code?: string })?.code ?? String(c)
    );
  }

  const approvedSubjects = data.approvedSubjects as number | undefined;
  const totalSubjects = data.totalSubjects as number | undefined;
  let progressPercentage = data.progressPercentage as number | undefined;
  if (progressPercentage == null && approvedSubjects != null && totalSubjects) {
    progressPercentage = Math.round((approvedSubjects / totalSubjects) * 1000) / 10;
  }
  const approvedCredits = data.approvedCredits as number | undefined;
  const totalCredits = data.totalCredits as number | undefined;
  if (progressPercentage == null && approvedCredits != null && totalCredits) {
    progressPercentage = Math.round((approvedCredits / totalCredits) * 1000) / 10;
  }

  const studentRef = `student:${externalStudentId}`;

  return {
    studentRef,
    externalStudentId: (data.externalStudentId as string) ?? externalStudentId,
    displayName: data.displayName as string | undefined,
    email: data.email as string | undefined,
    facultyCode: data.facultyCode as string | undefined,
    facultyName: data.facultyName as string | undefined,
    programCode: (data.programCode as string) ?? 'UNKNOWN',
    programName: (data.programName as string) ?? 'Unknown Program',
    degreeLevel: normalizeEnum(data.degreeLevel, DEGREE_MAP, 'other'),
    modality: normalizeEnum(data.modality, MODALITY_MAP, 'other'),
    cohort: data.cohort as string | undefined,
    academicStatus: normalizeEnum(
      String(data.academicStatus ?? 'unknown').toLowerCase(),
      config.statusMap,
      'unknown'
    ),
    approvedCredits,
    totalCredits,
    approvedSubjects,
    totalSubjects,
    progressPercentage,
    gpa: data.gpa as number | undefined,
    completedCourseCodes,
    skills: (raw as Record<string, unknown>)?.skills as string[] | undefined,
    lastSyncedAt: new Date().toISOString(),
  };
}
