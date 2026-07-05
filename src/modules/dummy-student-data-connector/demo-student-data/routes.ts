import { Router, Request, Response } from 'express';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { NotFoundError } from '../../../app/utils/errors';
import { ProviderSchema } from '../../../platform/types';
import { PROFILE_MAPPINGS, buildAcademicProfile } from './profiles';

const router = Router();

function getProfile(req: Request): string {
  return (req.query.providerProfile as string) || 'progress_percentage';
}

router.get('/schema', asyncHandler(async (req: Request, res: Response) => {
  const profile = getProfile(req);
  const mapping = PROFILE_MAPPINGS[profile];
  const schema: ProviderSchema = {
    providerKey: 'dummy-student-data',
    providerProfile: profile,
    fields: Object.entries(mapping?.mappings ?? {}).map(([field, path]) => ({
      path,
      type: 'string',
      required: mapping?.required?.includes(field) ?? false,
      description: `Maps to ${field}`,
    })),
  };
  res.json(schema);
}));

router.get('/students', asyncHandler(async (req: Request, res: Response) => {
  const profile = getProfile(req);
  const q = (req.query.query as string) || '';
  let query = db('demo_students').where({ provider_profile: profile });
  if (q) {
    query = query.where(function () {
      this.whereILike('display_name', `%${q}%`)
        .orWhereILike('external_student_id', `%${q}%`)
        .orWhereILike('email', `%${q}%`);
    });
  }
  const rows = await query;
  res.json(rows.map((r) => ({
    externalStudentId: r.external_student_id,
    displayName: r.display_name,
    email: r.email,
    raw: typeof r.raw === 'string' ? JSON.parse(r.raw) : r.raw,
  })));
}));

router.get('/students/:externalStudentId', asyncHandler(async (req: Request, res: Response) => {
  const profile = getProfile(req);
  const row = await db('demo_students')
    .where({ external_student_id: req.params.externalStudentId, provider_profile: profile })
    .first();
  if (!row) throw new NotFoundError('Student not found');
  res.json({
    externalStudentId: row.external_student_id,
    displayName: row.display_name,
    email: row.email,
    raw: typeof row.raw === 'string' ? JSON.parse(row.raw) : row.raw,
  });
}));

router.get('/students/:externalStudentId/academic-profile', asyncHandler(async (req: Request, res: Response) => {
  const profile = getProfile(req);
  const row = await db('demo_students')
    .where({ external_student_id: req.params.externalStudentId })
    .first();
  if (!row) throw new NotFoundError('Student not found');
  const raw = typeof row.raw === 'string' ? JSON.parse(row.raw) : row.raw;
  const academicProfile = buildAcademicProfile(row.external_student_id, profile, raw);
  res.json(academicProfile);
}));

router.get('/students/:externalStudentId/program-progress', asyncHandler(async (req: Request, res: Response) => {
  const profile = getProfile(req);
  const row = await db('demo_students')
    .where({ external_student_id: req.params.externalStudentId })
    .first();
  if (!row) throw new NotFoundError('Student not found');
  const raw = typeof row.raw === 'string' ? JSON.parse(row.raw) : row.raw;
  const academic = buildAcademicProfile(row.external_student_id, profile, raw);
  res.json({
    externalStudentId: row.external_student_id,
    approvedCredits: academic.approvedCredits,
    totalCredits: academic.totalCredits,
    approvedSubjects: academic.approvedSubjects,
    totalSubjects: academic.totalSubjects,
    progressPercentage: academic.progressPercentage,
  });
}));

router.get('/programs', asyncHandler(async (_req: Request, res: Response) => {
  res.json([
    { facultyCode: 'ING', facultyName: 'Facultad de Ingeniería', programCode: 'ING-SIS', programName: 'Ingeniería en Sistemas', degreeLevel: 'engineering', modality: 'onsite' },
    { facultyCode: 'ECO', facultyName: 'Facultad de Ciencias Económicas', programCode: 'ADM-001', programName: 'Administración de Empresas', degreeLevel: 'bachelor', modality: 'hybrid' },
    { facultyCode: 'SAL', facultyName: 'Facultad de Ciencias de la Salud', programCode: 'PSI', programName: 'Psicología', degreeLevel: 'bachelor', modality: 'onsite' },
  ]);
}));

export default router;
