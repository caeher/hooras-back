import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { NotFoundError } from '../../../app/utils/errors';
import { writeAuditEvent } from '../../../app/utils/audit';
import { getService } from '../../../platform/module/ServiceRegistry';
import { NOTIFICATIONS_V1, NotificationsServiceV1 } from '../../../platform/contracts/services';
import { mapRequirement } from '../services/documents.service';

const requirementSchema = z.object({
  key: z.string(),
  label: z.string(),
  required: z.boolean(),
  appliesTo: z.object({
    projectType: z.string().optional(),
    facultyCode: z.string().optional(),
    programCode: z.string().optional(),
  }).optional(),
  allowedFileTypes: z.array(z.string()),
  maxFileSizeMb: z.number().optional(),
  requiresApproval: z.boolean().optional(),
  templateId: z.string().optional(),
});

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

router.get('/document-requirements', authMiddleware, asyncHandler(async (_req: Request, res: Response) => {
  const rows = await db('document_requirements').select('*');
  res.json(rows.map(mapRequirement));
}));

router.post('/document-requirements', authMiddleware, rbac('admin', 'coordinator'), validate(requirementSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const [row] = await db('document_requirements')
    .insert({
      id: uuidv4(),
      key: body.key,
      label: body.label,
      required: body.required,
      applies_to: JSON.stringify(body.appliesTo ?? {}),
      allowed_file_types: JSON.stringify(body.allowedFileTypes),
      max_file_size_mb: body.maxFileSizeMb,
      requires_approval: body.requiresApproval ?? true,
      template_id: body.templateId,
    })
    .returning('*');
  res.status(201).json(mapRequirement(row));
}));

router.get('/documents', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  let query = db('document_uploads').select('*');
  if (req.query.studentRef) query = query.where({ owner_ref: req.query.studentRef });
  if (req.query.assignmentId) query = query.where({ assignment_id: req.query.assignmentId });
  const rows = await query.orderBy('uploaded_at', 'desc');
  res.json(rows.map(mapDocument));
}));

router.post('/documents', authMiddleware, validate(uploadSchema), asyncHandler(async (req: Request, res: Response) => {
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
  await notifications.send('document_approved', row.owner_ref as string, { documentId: row.id });
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
    documentId: row.id,
    reason: req.body.reason,
  });
  res.json(mapDocument(row));
}));

export default router;
