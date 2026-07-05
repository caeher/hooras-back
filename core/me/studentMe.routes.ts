import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { authMiddleware } from '../../app/middleware/auth';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../app/utils/errors';
import { assertStudentEligibleForAction } from '../../app/rules/assertStudentEligible';
import { writeAuditEvent } from '../../app/utils/audit';
import { uploadMiddleware, persistUploadedFile } from '../../app/storage/multerConfig';
import { mapAssignment } from '../../modules/assignments/services/assignments.service';
import { mapProject } from '../../modules/projects/services/projects.service';
import { enrichHourLogsWithEvidence, mapHourLogRow } from '../../modules/hours/services/hourLogMapper';

const hourLogSchema = z.object({
  assignmentId: z.string().uuid(),
  date: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationHours: z.number().positive(),
  category: z.enum(['disciplinary', 'environmental', 'community', 'research', 'administrative', 'other']),
  description: z.string(),
  evidenceIds: z.array(z.string().uuid()).optional(),
});

const router = Router();

function requireStudent(req: Request) {
  if (!req.user?.studentRef) throw new ForbiddenError('Current user is not a student');
  return req.user.studentRef;
}

function mapApplication(row: Record<string, unknown>) {
  return {
    id: row.id,
    projectId: row.project_id,
    studentRef: row.student_ref,
    status: row.status,
    motivation: row.motivation,
    rejectionReason: row.rejection_reason,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
  };
}

router.get('/applications', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const studentRef = requireStudent(req);
  const rows = await db('project_applications')
    .where({ student_ref: studentRef })
    .orderBy('created_at', 'desc');
  res.json(rows.map(mapApplication));
}));

router.get('/assignments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const studentRef = requireStudent(req);
  const rows = await db('assignments').where({ student_ref: studentRef });
  const projects = await db('projects').whereIn('id', rows.map((r) => r.project_id));
  const projectMap = new Map(projects.map((p) => [p.id, mapProject(p)]));
  res.json(
    rows.map((row) => ({
      ...mapAssignment(row),
      project: projectMap.get(row.project_id as string) ?? null,
    })),
  );
}));

router.get('/hour-logs', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const studentRef = requireStudent(req);
  const assignmentIds = await db('assignments').where({ student_ref: studentRef }).pluck('id');
  if (!assignmentIds.length) return res.json([]);
  let query = db('hour_logs').whereIn('assignment_id', assignmentIds);
  if (req.query.status) query = query.where({ status: req.query.status });
  const rows = await query.orderBy('created_at', 'desc');
  res.json(await enrichHourLogsWithEvidence(rows.map(mapHourLogRow)));
}));

router.post('/hour-logs', authMiddleware, validate(hourLogSchema), asyncHandler(async (req: Request, res: Response) => {
  const studentRef = requireStudent(req);
  await assertStudentEligibleForAction(studentRef, undefined, req.user!.externalUserId);

  const assignment = await db('assignments').where({ id: req.body.assignmentId }).first();
  if (!assignment) throw new NotFoundError('Assignment not found');
  if (assignment.student_ref !== studentRef) {
    throw new ForbiddenError('Cannot log hours for another student assignment');
  }
  if (assignment.status !== 'active') {
    throw new BadRequestError('Hours can only be logged for active assignments');
  }

  const evidenceIds: string[] = req.body.evidenceIds ?? [];
  if (evidenceIds.length) {
    const evidenceRows = await db('evidence').whereIn('id', evidenceIds);
    if (evidenceRows.length !== evidenceIds.length) {
      throw new BadRequestError('One or more evidence files were not found');
    }
    for (const ev of evidenceRows) {
      if (ev.owner_ref !== studentRef) {
        throw new ForbiddenError('Cannot attach evidence owned by another student');
      }
    }
  }

  const [row] = await db('hour_logs')
    .insert({
      id: uuidv4(),
      assignment_id: req.body.assignmentId,
      date: req.body.date,
      start_time: req.body.startTime,
      end_time: req.body.endTime,
      duration_hours: req.body.durationHours,
      category: req.body.category,
      description: req.body.description,
      evidence_ids: JSON.stringify(evidenceIds),
      status: 'pending',
      created_at: new Date(),
    })
    .returning('*');

  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'hour_log.created',
    entityType: 'hour_log',
    entityId: row.id as string,
  });

  res.status(201).json(mapHourLogRow(row));
}));

router.post('/evidence', authMiddleware, uploadMiddleware.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const studentRef = requireStudent(req);
  if (!req.file) throw new BadRequestError('File is required');

  const id = uuidv4();
  const { storageRef } = await persistUploadedFile(req.file, 'files');
  await db('evidence').insert({
    id,
    owner_ref: studentRef,
    file_name: req.file.originalname,
    storage_ref: storageRef,
    created_at: new Date(),
  });

  res.status(201).json({
    id,
    fileName: req.file.originalname,
    storageRef,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
  });
}));

router.get('/social-services/history', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const studentRef = requireStudent(req);
  const assignments = await db('assignments')
    .where({ student_ref: studentRef })
    .whereIn('status', ['completed', 'cancelled'])
    .orderBy('updated_at', 'desc');

  const history = await Promise.all(
    assignments.map(async (assignment) => {
      const project = await db('projects').where({ id: assignment.project_id }).first();
      const approvedHours = await db('hour_logs')
        .where({ assignment_id: assignment.id, status: 'approved' })
        .sum('duration_hours as total')
        .first();
      const certificate = await db('document_uploads')
        .where({ assignment_id: assignment.id, owner_ref: studentRef })
        .whereNull('document_requirement_id')
        .where({ status: 'approved' })
        .first();

      return {
        assignmentId: assignment.id,
        status: assignment.status,
        project: project ? mapProject(project) : null,
        organizationName: project?.organization_name,
        period: {
          startsAt: project?.starts_at,
          endsAt: project?.ends_at,
        },
        approvedHours: Number(approvedHours?.total ?? 0),
        certificate: certificate
          ? { id: certificate.id, fileName: certificate.file_name, storageRef: certificate.storage_ref }
          : null,
        completedAt: assignment.updated_at,
      };
    }),
  );

  res.json(history);
}));

export default router;
