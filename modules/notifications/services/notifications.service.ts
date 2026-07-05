import { v4 as uuidv4 } from 'uuid';
import db from '../../../database';
import {
  NotificationEvent,
  NotificationsServiceV1,
} from '../../../platform/contracts/services';
import { NotFoundError, ForbiddenError } from '../../../app/utils/errors';

const EVENT_TEMPLATES: Record<NotificationEvent, (payload: Record<string, unknown>) => { title: string; body: string }> = {
  application_submitted: () => ({
    title: 'Application submitted',
    body: 'Your project application has been submitted and is pending review.',
  }),
  application_approved: () => ({
    title: 'Application approved',
    body: 'Your project application has been approved. You have been assigned to the project.',
  }),
  application_rejected: (p) => ({
    title: 'Application rejected',
    body: `Your application was rejected.${p.reason ? ` Reason: ${p.reason}` : ''}`,
  }),
  application_status_changed: (p) => ({
    title: 'Application status updated',
    body: `Your application status is now ${p.status ?? 'updated'}.`,
  }),
  missing_document: (p) => ({
    title: 'Missing document',
    body: `Please upload required document: ${p.documentName ?? 'document'}.`,
  }),
  document_requested: (p) => ({
    title: 'Document requested',
    body: `Please upload: ${p.documentName ?? 'required document'}.`,
  }),
  document_uploaded: () => ({
    title: 'Document uploaded',
    body: 'Your document upload was received and is pending review.',
  }),
  document_approved: () => ({
    title: 'Document approved',
    body: 'Your document has been approved.',
  }),
  document_rejected: (p) => ({
    title: 'Document rejected',
    body: `Your document was rejected.${p.reason ? ` Reason: ${p.reason}` : ''}`,
  }),
  hours_approved: () => ({
    title: 'Hours approved',
    body: 'Your hour log entry has been approved.',
  }),
  hours_rejected: (p) => ({
    title: 'Hours rejected',
    body: `Your hour log was rejected.${p.reason ? ` Reason: ${p.reason}` : ''}`,
  }),
  assignment_created: () => ({
    title: 'Assignment created',
    body: 'You have been assigned to a social service project.',
  }),
  rule_blocked: (p) => ({
    title: 'Action blocked',
    body: String(p.reason ?? 'You do not meet eligibility requirements.'),
  }),
  project_deadline_approaching: (p) => ({
    title: 'Project deadline approaching',
    body: `Deadline: ${p.deadline ?? 'soon'}.`,
  }),
  final_report_required: () => ({
    title: 'Final report required',
    body: 'Please submit your final report for your social service.',
  }),
  certificate_generated: () => ({
    title: 'Certificate ready',
    body: 'Your social service certificate is ready.',
  }),
};

function mapNotification(row: Record<string, unknown>) {
  return {
    id: row.id,
    eventType: row.event_type,
    title: row.title,
    body: row.body,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    readAt: row.read_at ? (row.read_at as Date).toISOString() : null,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
  };
}

function resolveStudentRef(recipient: string): string {
  return recipient;
}

export const notificationsService: NotificationsServiceV1 = {
  async send(eventType: NotificationEvent, recipient: string, payload: Record<string, unknown> = {}) {
    const messageId = uuidv4();
    const template = EVENT_TEMPLATES[eventType](payload);
    const studentRef = (payload.studentRef as string) ?? resolveStudentRef(recipient);
    await db('notifications').insert({
      id: uuidv4(),
      provider_key: 'zavu',
      event_type: eventType,
      recipient,
      recipient_student_ref: studentRef,
      title: template.title,
      body: template.body,
      status: 'sent',
      channel: 'in_app',
      payload: JSON.stringify({ ...payload, messageId }),
      external_message_id: messageId,
      created_at: new Date(),
    });
    console.log(`[ZAVU stub] ${eventType} -> ${recipient}`);
    return messageId;
  },

  async listForStudent(studentRef, options = {}) {
    let query = db('notifications')
      .where({ recipient_student_ref: studentRef })
      .orderBy('created_at', 'desc');
    if (options.unreadOnly) query = query.whereNull('read_at');
    if (options.limit) query = query.limit(options.limit);
    if (options.offset) query = query.offset(options.offset);
    const rows = await query;
    return rows.map(mapNotification);
  },

  async markRead(notificationId, studentRef) {
    const row = await db('notifications').where({ id: notificationId }).first();
    if (!row) throw new NotFoundError('Notification not found');
    if (row.recipient_student_ref !== studentRef) {
      throw new ForbiddenError('Cannot mark another student notification as read');
    }
    const [updated] = await db('notifications')
      .where({ id: notificationId })
      .update({ read_at: new Date() })
      .returning('*');
    return mapNotification(updated);
  },
};
