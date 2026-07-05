import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { BadRequestError } from '../../../app/utils/errors';
import { writeAuditEvent } from '../../../app/utils/audit';
import { getService } from '../../../platform/module/ServiceRegistry';
import {
  RULES_V1,
  RulesServiceV1,
  HOURS_V1,
  HoursServiceV1,
  DOCUMENTS_V1,
  DocumentsServiceV1,
  NOTIFICATIONS_V1,
  NotificationsServiceV1,
} from '../../../platform/contracts/services';

const generateSchema = z.object({
  studentRef: z.string(),
  assignmentId: z.string().uuid().optional(),
});

const router = Router();

router.post('/generate', authMiddleware, rbac('coordinator', 'admin'), validate(generateSchema), asyncHandler(async (req: Request, res: Response) => {
  const { studentRef, assignmentId } = req.body;

  const rulesService = getService<RulesServiceV1>(RULES_V1);
  const hoursService = getService<HoursServiceV1>(HOURS_V1);
  const documentsService = getService<DocumentsServiceV1>(DOCUMENTS_V1);
  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);

  const eligibility = await rulesService.evaluateRules(studentRef);
  if (eligibility.status !== 'eligible') {
    throw new BadRequestError('Student is not eligible for certificate generation');
  }

  const completedHours = await hoursService.getStudentHours(studentRef);
  if (completedHours < eligibility.requiredHours) {
    throw new BadRequestError(`Student has ${completedHours} approved hours, requires ${eligibility.requiredHours}`);
  }

  const verificationCode = randomBytes(8).toString('hex').toUpperCase();
  const docId = await documentsService.createCertificateDocument(studentRef, assignmentId, verificationCode);

  const [cert] = await db('certificates')
    .insert({
      id: uuidv4(),
      student_ref: studentRef,
      assignment_id: assignmentId,
      status: 'generated',
      document_id: docId,
      verification_code: verificationCode,
      generated_at: new Date(),
    })
    .returning('*');

  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'certificate.generated',
    entityType: 'certificate',
    entityId: cert.id as string,
  });

  await notifications.send('certificate_generated', studentRef, {
    certificateId: cert.id,
    verificationCode,
  });

  res.status(201).json({
    id: cert.id,
    studentRef: cert.student_ref,
    assignmentId: cert.assignment_id,
    status: cert.status,
    documentId: cert.document_id,
    verificationCode: cert.verification_code,
    generatedAt: (cert.generated_at as Date)?.toISOString?.() ?? cert.generated_at,
  });
}));

export default router;
