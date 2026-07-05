import { v4 as uuidv4 } from 'uuid';
import db from '../../../database';
import { ProjectsServiceV1 } from '../../../platform/contracts/services';

function mapProject(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    organizationName: row.organization_name,
    location: row.location,
    modality: row.modality,
    categories: typeof row.categories === 'string' ? JSON.parse(row.categories) : row.categories,
    capacity: row.capacity,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    applicationDeadline: row.application_deadline,
    publicSafe: row.public_safe,
    status: row.status,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    extractionConfidence: row.extraction_confidence ? Number(row.extraction_confidence) : undefined,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
  };
}

export const projectsService: ProjectsServiceV1 = {
  async getById(projectId) {
    const row = await db('projects').where({ id: projectId }).first();
    return row ? mapProject(row) : null;
  },

  async createFromImport(extracted, sourceUrl, confidence?) {
    const [row] = await db('projects')
      .insert({
        id: uuidv4(),
        title: extracted.title,
        description: extracted.description,
        organization_name: extracted.organizationName,
        location: extracted.location,
        modality: extracted.modality,
        categories: JSON.stringify(extracted.categories ?? []),
        status: 'pending_review',
        source_type: 'scraped',
        source_url: sourceUrl,
        extraction_confidence: confidence,
        public_safe: extracted.publicSafe ?? false,
      })
      .returning('*');
    return mapProject(row);
  },
};

export { mapProject };
