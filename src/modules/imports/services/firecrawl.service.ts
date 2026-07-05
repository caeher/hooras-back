import { v4 as uuidv4 } from 'uuid';
import db from '../../../database';

interface CrawlRequest {
  startUrls: string[];
  query?: string;
  maxPages?: number;
}

const SAMPLE_PROJECTS = [
  {
    title: 'Reforestación Comunitaria San Salvador',
    description: 'Proyecto de reforestación en zonas urbanas de San Salvador. Participación en siembra y mantenimiento de árboles nativos.',
    organizationName: 'Fundación Verde El Salvador',
    location: 'San Salvador',
    modality: 'onsite',
    categories: ['environmental', 'community'],
  },
  {
    title: 'Tutorías para estudiantes de primaria',
    description: 'Apoyo académico a estudiantes de escuelas públicas en matemáticas y lectura.',
    organizationName: 'Aldeas Infantiles SOS',
    location: 'Santa Tecla',
    modality: 'onsite',
    categories: ['community', 'disciplinary'],
  },
  {
    title: 'Campaña de reciclaje municipal',
    description: 'Educación ambiental y recolección de materiales reciclables en comunidades.',
    organizationName: 'Municipalidad de Antiguo Cuscatlán',
    location: 'Antiguo Cuscatlán',
    modality: 'hybrid',
    categories: ['environmental'],
  },
];

export async function simulateFirecrawlRun(runId: string, request: CrawlRequest): Promise<void> {
  await db('import_runs').where({ id: runId }).update({ status: 'running' });

  setTimeout(async () => {
    try {
      const maxResults = Math.min(request.maxPages ?? 3, SAMPLE_PROJECTS.length);
      for (let i = 0; i < maxResults; i++) {
        const sample = SAMPLE_PROJECTS[i];
        const sourceUrl = request.startUrls[i % request.startUrls.length] ?? request.startUrls[0];
        await db('import_results').insert({
          id: uuidv4(),
          run_id: runId,
          status: 'pending_review',
          source_url: sourceUrl,
          extracted_project: JSON.stringify({
            title: sample.title,
            description: sample.description,
            organizationName: sample.organizationName,
            location: sample.location,
            modality: sample.modality,
            categories: sample.categories,
            publicSafe: false,
          }),
          extraction_confidence: 0.75 + Math.random() * 0.2,
          duplicate_project_ids: JSON.stringify([]),
          created_at: new Date(),
        });
      }
      await db('import_runs').where({ id: runId }).update({
        status: 'completed',
        completed_at: new Date(),
      });
    } catch (e) {
      await db('import_runs').where({ id: runId }).update({ status: 'failed' });
      console.error('[Firecrawl stub] Run failed:', e);
    }
  }, 2000);
}
