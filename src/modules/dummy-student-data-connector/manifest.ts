export const dummyStudentDataManifest = {
  moduleKey: 'dummy-student-data-connector',
  displayName: 'Dummy Student Data Connector',
  version: '0.1.0',
  moduleType: 'student_data_connector' as const,
  description: 'MVP student-data connector with configurable provider profiles',
  author: 'Social Hours Platform',
  license: 'MIT',
  platformVersion: '0.1.0',
  dependencies: [] as string[],
  capabilities: [
    'student.search', 'student.profile.read', 'student.progress.read',
    'student.programs.read', 'student.schema.read',
  ],
  features: [
    {
      key: 'student_search',
      name: 'Student search',
      default: true,
      capabilities: ['student.search'],
    },
    {
      key: 'student_profile',
      name: 'Student profile',
      default: true,
      capabilities: ['student.profile.read'],
    },
    {
      key: 'program_progress',
      name: 'Program progress',
      default: true,
      capabilities: ['student.progress.read'],
    },
    {
      key: 'programs_catalog',
      name: 'Programs catalog',
      default: true,
      capabilities: ['student.programs.read'],
    },
    {
      key: 'schema_metadata',
      name: 'Schema metadata',
      default: true,
      capabilities: ['student.schema.read'],
    },
  ],
  providedContracts: ['student_data.v1'],
  requiredSecrets: ['apiBaseUrl'],
  configurationSchema: {
    providerProfile: {
      type: 'string',
      enum: ['progress_percentage', 'credits_based', 'subjects_based', 'status_code_based'],
      default: 'progress_percentage',
    },
  },
  permissions: ['external.student_data.read'],
};
