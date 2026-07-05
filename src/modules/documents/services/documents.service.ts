import { v4 as uuidv4 } from 'uuid';
import db from '../../../database';
import { DocumentsServiceV1 } from '../../../platform/contracts/services';

function mapRequirement(row: Record<string, unknown>) {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    required: row.required,
    appliesTo: typeof row.applies_to === 'string' ? JSON.parse(row.applies_to) : row.applies_to,
    allowedFileTypes: typeof row.allowed_file_types === 'string'
      ? JSON.parse(row.allowed_file_types)
      : row.allowed_file_types,
    maxFileSizeMb: row.max_file_size_mb,
    requiresApproval: row.requires_approval,
    templateId: row.template_id,
  };
}

export const documentsService: DocumentsServiceV1 = {
  async listRequirements() {
    const rows = await db('document_requirements').select('*');
    return rows.map(mapRequirement);
  },

  async createCertificateDocument(studentRef, assignmentId?, verificationCode?) {
    const docId = uuidv4();
    const code = verificationCode ?? uuidv4().slice(0, 8).toUpperCase();
    await db('document_uploads').insert({
      id: docId,
      document_requirement_id: null,
      owner_ref: studentRef,
      file_name: `certificate-${code}.pdf`,
      storage_ref: `certificates/${code}.pdf`,
      assignment_id: assignmentId,
      status: 'approved',
      uploaded_at: new Date(),
    });
    return docId;
  },
};

export { mapRequirement };
