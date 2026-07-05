import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { BadRequestError, NotFoundError } from '../../../app/utils/errors';
import { writeAuditEvent } from '../../../app/utils/audit';
import { getService } from '../../../platform/module/ServiceRegistry';
import { PROJECTS_V1, ProjectsServiceV1 } from '../../../platform/contracts/services';
import {
  assertFirecrawlConfigured,
  FirecrawlIntegrationError,
  runFirecrawlImport,
} from '../services/firecrawl.service';
const runSchema = z.object({
  startUrls: z.array(z.string().url()),
  query: z.string().optional(),
  maxPages: z.number().min(1).optional(),
});

const router = Router();

function mapImportResult(row: Record<string, unknown>) {
  return {
    id: row.id,
    status: row.status,
    sourceUrl: row.source_url,
    extractedProject: typeof row.extracted_project === 'string'
      ? JSON.parse(row.extracted_project)
      : row.extracted_project,
    extractionConfidence: row.extraction_confidence ? Number(row.extraction_confidence) : undefined,
    duplicateProjectIds: typeof row.duplicate_project_ids === 'string'
      ? JSON.parse(row.duplicate_project_ids)
      : row.duplicate_project_ids,
  };
}

router.post('/firecrawl/runs', authMiddleware, rbac('coordinator', 'admin'), validate(runSchema), asyncHandler(async (req: Request, res: Response) => {
  try {
    assertFirecrawlConfigured();
  } catch (error) {
    if (error instanceof FirecrawlIntegrationError) {
      throw new BadRequestError(error.message, error.code);
    }
    throw error;
  }

  const runId = uuidv4();
  await db('import_runs').insert({
    id: runId,
    status: 'queued',
    request: JSON.stringify(req.body),
    created_at: new Date(),
  });
  void runFirecrawlImport(runId, req.body);
  res.status(202).json({ id: runId, status: 'queued', createdAt: new Date().toISOString() });
}));

router.get('/firecrawl/results', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  let query = db('import_results').select('*');
  if (req.query.status) query = query.where({ status: req.query.status });
  const rows = await query.orderBy('created_at', 'desc');
  res.json(rows.map(mapImportResult));
}));

router.post('/firecrawl/results/:importResultId/approve', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const result = await db('import_results').where({ id: req.params.importResultId }).first();
  if (!result) throw new NotFoundError('Import result not found');
  const extracted = typeof result.extracted_project === 'string'
    ? JSON.parse(result.extracted_project)
    : result.extracted_project;

  const projects = getService<ProjectsServiceV1>(PROJECTS_V1);
  const project = await projects.createFromImport(
    extracted,
    result.source_url as string,
    result.extraction_confidence ? Number(result.extraction_confidence) : undefined
  );

  await db('import_results').where({ id: req.params.importResultId }).update({ status: 'approved' });
  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'import.approved',
    entityType: 'import_result',
    entityId: result.id as string,
    metadata: { projectId: project.id },
  });
  res.status(201).json(project);
}));

router.post('/firecrawl/results/:importResultId/reject', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const [row] = await db('import_results')
    .where({ id: req.params.importResultId })
    .update({ status: 'rejected' })
    .returning('*');
  if (!row) throw new NotFoundError('Import result not found');
  res.json(mapImportResult(row));
}));

export default router;
