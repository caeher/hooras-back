import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { authMiddleware } from '../../../app/middleware/auth';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../../app/utils/errors';
import { assertStudentEligibleForAction } from '../../../app/rules/assertStudentEligible';
import { writeAuditEvent } from '../../../app/utils/audit';
import { uploadMiddleware, persistUploadedFile } from '../../../app/storage/multerConfig';
import { getService } from '../../../platform/module/ServiceRegistry';
import {
  DOCUMENTS_V1,
  DocumentsServiceV1,
  NOTIFICATIONS_V1,
  NotificationsServiceV1,
} from '../../../platform/contracts/services';
import { mapRequirement } from '../services/documents.service';

const router = Router();

function requireStudent(req: Request) {
  if (!req.user?.studentRef) throw new ForbiddenError('Current user is not a student');
  return req.user.studentRef;
}

router.get('/document-requirements', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const studentRef = requireStudent(req);
  const documents = getService<DocumentsServiceV1>(DOCUMENTS_V1);
  const matrix = await documents.getStudentUploadMatrix(studentRef);
  res.json(matrix);
}));

router.get('/document-uploads', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const studentRef = requireStudent(req);
  const rows = await db('document_uploads')
    .where({ owner_ref: studentRef })
    .orderBy('uploaded_at', 'desc');
  res.json(
    rows.map((row) => ({
      id: row.id,
      documentRequirementId: row.document_requirement_id,
      fileName: row.file_name,
      storageRef: row.storage_ref,
      status: row.status,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      uploadedAt: row.uploaded_at,
      rejectionReason: row.rejection_reason,
    })),
  );
}));

router.post(
  '/document-requirements/:requirementId/upload',
  authMiddleware,
  uploadMiddleware.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const studentRef = requireStudent(req);
    await assertStudentEligibleForAction(studentRef, undefined, req.user!.externalUserId);

    if (!req.file) throw new NotFoundError('File is required');

    const requirement = await db('document_requirements')
      .where({ id: req.params.requirementId })
      .first();
    if (!requirement || requirement.active === false) throw new NotFoundError('Document requirement not found');

    const documents = getService<DocumentsServiceV1>(DOCUMENTS_V1);
    documents.validateUpload(mapRequirement(requirement) as Record<string, unknown>, {
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });

    const { storageRef } = await persistUploadedFile(req.file, 'documents');
    const [row] = await db('document_uploads')
      .insert({
        id: uuidv4(),
        document_requirement_id: requirement.id,
        owner_ref: studentRef,
        file_name: req.file.originalname,
        storage_ref: storageRef,
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
        status: 'pending',
        uploaded_at: new Date(),
      })
      .returning('*');

    await writeAuditEvent({
      actorRef: req.user!.externalUserId,
      action: 'document.uploaded',
      entityType: 'document_upload',
      entityId: row.id as string,
    });

    const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
    await notifications.send('document_uploaded', studentRef, {
      studentRef,
      documentId: row.id,
      requirementId: requirement.id,
    });

    res.status(201).json({
      id: row.id,
      documentRequirementId: row.document_requirement_id,
      fileName: row.file_name,
      storageRef: row.storage_ref,
      status: row.status,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      uploadedAt: row.uploaded_at,
    });
  }),
);

export default router;
