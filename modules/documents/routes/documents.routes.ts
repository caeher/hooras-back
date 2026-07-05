import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { NotFoundError, BadRequestError } from '../../../app/utils/errors';
import { writeAuditEvent } from '../../../app/utils/audit';
import { getService } from '../../../platform/module/ServiceRegistry';
import { NOTIFICATIONS_V1, NotificationsServiceV1 } from '../../../platform/contracts/services';
import { mapRequirement } from '../services/documents.service';

const requirementSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean(),
  scope: z.enum(['global', 'project', 'program']).optional(),
  projectId: z.string().uuid().optional(),
  appliesTo: z.object({
    projectType: z.string().optional(),
    facultyCode: z.string().optional(),
    programCode: z.string().optional(),
  }).optional(),
  allowedFileTypes: z.array(z.string()),
  maxFileSizeMb: z.number().optional(),
  requiresApproval: z.boolean().optional(),
  templateId: z.string().optional(),
  active: z.boolean().optional(),
});

const requirementUpdateSchema = requirementSchema.partial();

const uploadSchema = z.object({
  documentRequirementId: z.string().uuid(),
  ownerRef: z.string(),
  fileName: z.string(),
  storageRef: z.string(),
  assignmentId: z.string().uuid().optional(),
});

const rejectSchema = z.object({ reason: z.string() });

const router = Router();

function mapDocument(row: Record<string, unknown>) {
  return {
    id: row.id,
    documentRequirementId: row.document_requirement_id,
    ownerRef: row.owner_ref,
    fileName: row.file_name,
    storageRef: row.storage_ref,
    assignmentId: row.assignment_id,
    status: row.status,
    rejectionReason: row.rejection_reason,
    uploadedAt: (row.uploaded_at as Date)?.toISOString?.() ?? row.uploaded_at,
  };
}

router.get('/document-requirements', authMiddleware, rbac('admin', 'coordinator'), asyncHandler(async (_req: Request, res: Response) => {
  const rows = await db('document_requirements').select('*');
  res.json(rows.map(mapRequirement));
}));

router.post('/document-requirements', authMiddleware, rbac('admin', 'coordinator'), validate(requirementSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const existing = await db('document_requirements')
    .where({ key: body.key, active: true })
    .first();
  if (existing) {
    throw new BadRequestError(`An active document requirement with key '${body.key}' already exists`);
  }

  const [row] = await db('document_requirements')
    .insert({
      id: uuidv4(),
      key: body.key,
      label: body.label,
      description: body.description ?? null,
      required: body.required,
      scope: body.scope ?? 'global',
      project_id: body.projectId ?? null,
      applies_to: JSON.stringify(body.appliesTo ?? {}),
      allowed_file_types: JSON.stringify(body.allowedFileTypes),
      max_file_size_mb: body.maxFileSizeMb,
      requires_approval: body.requiresApproval ?? true,
      template_id: body.templateId,
      created_by: req.user!.externalUserId,
    })
    .returning('*');
  res.status(201).json(mapRequirement(row));
}));

router.patch('/document-requirements/:id', authMiddleware, rbac('admin', 'coordinator'), validate(requirementUpdateSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const currentReq = await db('document_requirements')
    .where({ id: req.params.id })
    .first();
  if (!currentReq) throw new NotFoundError('Document requirement not found');

  const targetKey = body.key !== undefined ? body.key : currentReq.key;
  const targetActive = body.active !== undefined ? body.active : (currentReq.active ?? true);

  if (targetActive) {
    const existing = await db('document_requirements')
      .where({ key: targetKey, active: true })
      .whereNot({ id: req.params.id })
      .first();
    if (existing) {
      throw new BadRequestError(`An active document requirement with key '${targetKey}' already exists`);
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.key !== undefined) updates.key = body.key;
  if (body.label !== undefined) updates.label = body.label;
  if (body.description !== undefined) updates.description = body.description;
  if (body.required !== undefined) updates.required = body.required;
  if (body.scope !== undefined) updates.scope = body.scope;
  if (body.projectId !== undefined) updates.project_id = body.projectId;
  if (body.appliesTo !== undefined) updates.applies_to = JSON.stringify(body.appliesTo);
  if (body.allowedFileTypes !== undefined) updates.allowed_file_types = JSON.stringify(body.allowedFileTypes);
  if (body.maxFileSizeMb !== undefined) updates.max_file_size_mb = body.maxFileSizeMb;
  if (body.requiresApproval !== undefined) updates.requires_approval = body.requiresApproval;
  if (body.templateId !== undefined) updates.template_id = body.templateId;
  if (body.active !== undefined) updates.active = body.active;

  const [row] = await db('document_requirements')
    .where({ id: req.params.id })
    .update(updates)
    .returning('*');
  res.json(mapRequirement(row));
}));

router.delete('/document-requirements/:id', authMiddleware, rbac('admin', 'coordinator'), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const currentReq = await db('document_requirements').where({ id }).first();
  if (!currentReq) throw new NotFoundError('Document requirement not found');

  const uploadsCount = await db('document_uploads')
    .where({ document_requirement_id: id })
    .count({ count: '*' })
    .first();
  const hasUploads = parseInt(String(uploadsCount?.count ?? '0'), 10) > 0;

  if (!hasUploads) {
    await db('document_requirements')
      .where({ id })
      .delete();
    res.json({
      ...mapRequirement(currentReq),
      active: false,
      deleted: true,
    });
  } else {
    const [row] = await db('document_requirements')
      .where({ id })
      .update({ active: false })
      .returning('*');
    res.json(mapRequirement(row));
  }
}));

router.get('/documents', authMiddleware, rbac('coordinator', 'faculty_supervisor', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  let query = db('document_uploads').select('*');
  if (req.query.studentRef) query = query.where({ owner_ref: req.query.studentRef });
  if (req.query.assignmentId) query = query.where({ assignment_id: req.query.assignmentId });
  if (req.query.status) query = query.where({ status: req.query.status });
  const rows = await query.orderBy('uploaded_at', 'desc');
  res.json(rows.map(mapDocument));
}));

router.post('/documents', authMiddleware, rbac('coordinator', 'admin'), validate(uploadSchema), asyncHandler(async (req: Request, res: Response) => {
  const [row] = await db('document_uploads')
    .insert({
      id: uuidv4(),
      document_requirement_id: req.body.documentRequirementId,
      owner_ref: req.body.ownerRef,
      file_name: req.body.fileName,
      storage_ref: req.body.storageRef,
      assignment_id: req.body.assignmentId,
      status: 'pending',
      uploaded_at: new Date(),
    })
    .returning('*');
  res.status(201).json(mapDocument(row));
}));

router.post('/documents/:documentId/approve', authMiddleware, rbac('coordinator', 'faculty_supervisor', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const [row] = await db('document_uploads')
    .where({ id: req.params.documentId })
    .update({ status: 'approved' })
    .returning('*');
  if (!row) throw new NotFoundError('Document not found');
  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'document.approved',
    entityType: 'document_upload',
    entityId: row.id as string,
  });
  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
  await notifications.send('document_approved', row.owner_ref as string, {
    studentRef: row.owner_ref,
    documentId: row.id,
  });
  res.json(mapDocument(row));
}));

router.post('/documents/:documentId/reject', authMiddleware, rbac('coordinator', 'faculty_supervisor', 'admin'), validate(rejectSchema), asyncHandler(async (req: Request, res: Response) => {
  const [row] = await db('document_uploads')
    .where({ id: req.params.documentId })
    .update({ status: 'rejected', rejection_reason: req.body.reason })
    .returning('*');
  if (!row) throw new NotFoundError('Document not found');
  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
  await notifications.send('document_rejected', row.owner_ref as string, {
    studentRef: row.owner_ref,
    documentId: row.id,
    reason: req.body.reason,
  });
  res.json(mapDocument(row));
}));

export default router;
