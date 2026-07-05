import { v4 as uuidv4 } from 'uuid';
import db from '../../../database';
import { env } from '../../../config/env';

interface CrawlRequest {
  startUrls: string[];
  query?: string;
  maxPages?: number;
}

interface ProjectInput {
  title: string;
  description: string;
  organizationName: string;
  location?: string;
  modality?: 'onsite' | 'remote' | 'hybrid';
  categories: string[];
  publicSafe?: boolean;
}

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
      url?: string;
      [key: string]: unknown;
    };
  };
  error?: string;
}

interface FirecrawlErrorDetails {
  statusCode?: number;
  responseBody?: unknown;
  retryable?: boolean;
}

export class FirecrawlIntegrationError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(message: string, code: string, details: FirecrawlErrorDetails = {}) {
    super(message);
    this.name = 'FirecrawlIntegrationError';
    this.code = code;
    this.statusCode = details.statusCode;
    this.retryable = details.retryable ?? false;
    this.details = details.responseBody;
  }
}

export function assertFirecrawlConfigured(): void {
  if (!env.FIRECRAWL_API_KEY) {
    throw new FirecrawlIntegrationError(
      'FIRECRAWL_API_KEY is required to run Firecrawl imports',
      'FIRECRAWL_NOT_CONFIGURED'
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function postFirecrawl<T>(path: string, body: unknown, attempt = 1): Promise<T> {
  assertFirecrawlConfigured();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.FIRECRAWL_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizeBaseUrl(env.FIRECRAWL_API_URL)}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const responseBody = await readResponseBody(response);
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < 3) {
        await sleep(500 * attempt);
        return postFirecrawl<T>(path, body, attempt + 1);
      }

      throw new FirecrawlIntegrationError(
        `Firecrawl request failed with status ${response.status}`,
        'FIRECRAWL_HTTP_ERROR',
        { statusCode: response.status, responseBody, retryable }
      );
    }

    return responseBody as T;
  } catch (error) {
    if (error instanceof FirecrawlIntegrationError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new FirecrawlIntegrationError(
        `Firecrawl request timed out after ${env.FIRECRAWL_TIMEOUT_MS}ms`,
        'FIRECRAWL_TIMEOUT',
        { retryable: true }
      );
    }
    throw new FirecrawlIntegrationError(
      `Firecrawl request failed: ${(error as Error).message}`,
      'FIRECRAWL_REQUEST_FAILED',
      { retryable: true }
    );
  } finally {
    clearTimeout(timeout);
  }
}

function compactText(value: string | undefined, fallback = ''): string {
  return (value ?? fallback).replace(/\s+/g, ' ').trim();
}

function inferCategories(text: string): string[] {
  const lower = text.toLowerCase();
  const categories = new Set<string>();
  if (/(ambiente|ambiental|recicla|reforest|limpieza|sostenib)/i.test(lower)) categories.add('environmental');
  if (/(comunidad|comunitari|voluntariado|apoyo|social|niñ|adulto|familia)/i.test(lower)) categories.add('community');
  if (/(tutor|educa|clase|acad[eé]mic|lectura|matem[aá]tica)/i.test(lower)) categories.add('disciplinary');
  return categories.size > 0 ? [...categories] : ['community'];
}

function inferModality(text: string): ProjectInput['modality'] {
  if (/(h[ií]brid|mixto|semipresencial)/i.test(text)) return 'hybrid';
  if (/(remote|remoto|online|virtual)/i.test(text)) return 'remote';
  return 'onsite';
}

function extractOrganization(text: string): string {
  const patterns = [
    /(?:organizaci[oó]n|instituci[oó]n|fundaci[oó]n|empresa|ONG)\s*:\s*(.+?)(?:\.|\n|$)/i,
    /(?:por|de)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ&., ]{3,80})(?:\.|\n|$)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return compactText(match[1]).slice(0, 120);
  }

  return 'Organización pendiente de revisión';
}

function buildProjectFromScrape(data: FirecrawlScrapeResponse['data']): ProjectInput {
  const content = compactText(data?.markdown || data?.html);
  const title = compactText(data?.metadata?.title, 'Proyecto importado').slice(0, 180);
  const description =
    compactText(data?.metadata?.description || content, 'Descripción pendiente de revisión').slice(0, 1200);
  const combined = `${title} ${description} ${content}`;

  return {
    title,
    description,
    organizationName: extractOrganization(combined),
    location: undefined,
    modality: inferModality(combined),
    categories: inferCategories(combined),
    publicSafe: false,
  };
}

function confidenceFor(data: FirecrawlScrapeResponse['data'], project: ProjectInput): number {
  let score = 0.45;
  if (data?.metadata?.title) score += 0.15;
  if (data?.metadata?.description) score += 0.15;
  if (project.organizationName !== 'Organización pendiente de revisión') score += 0.1;
  if ((data?.markdown?.length ?? data?.html?.length ?? 0) > 500) score += 0.1;
  return Math.min(0.95, score);
}

async function scrapeProject(url: string): Promise<{ sourceUrl: string; project: ProjectInput; confidence: number }> {
  const response = await postFirecrawl<FirecrawlScrapeResponse>('/scrape', {
    url,
    formats: ['markdown', 'html'],
    onlyMainContent: true,
  });

  if (response.success === false || !response.data) {
    throw new FirecrawlIntegrationError(
      response.error || 'Firecrawl returned an empty scrape response',
      'FIRECRAWL_EMPTY_RESPONSE',
      { responseBody: response }
    );
  }

  const sourceUrl = response.data.metadata?.sourceURL || response.data.metadata?.url || url;
  const project = buildProjectFromScrape(response.data);
  return { sourceUrl, project, confidence: confidenceFor(response.data, project) };
}

export async function runFirecrawlImport(runId: string, request: CrawlRequest): Promise<void> {
  await db('import_runs').where({ id: runId }).update({ status: 'running' });

  try {
    const maxResults = Math.min(request.maxPages ?? request.startUrls.length, request.startUrls.length);
    const urls = request.startUrls.slice(0, maxResults);
    for (const url of urls) {
      const result = await scrapeProject(url);
      await db('import_results').insert({
        id: uuidv4(),
        run_id: runId,
        status: 'pending_review',
        source_url: result.sourceUrl,
        extracted_project: JSON.stringify(result.project),
        extraction_confidence: result.confidence,
        duplicate_project_ids: JSON.stringify([]),
        created_at: new Date(),
      });
    }

    await db('import_runs').where({ id: runId }).update({
      status: 'completed',
      completed_at: new Date(),
    });
  } catch (error) {
    const firecrawlError = error instanceof FirecrawlIntegrationError
      ? error
      : new FirecrawlIntegrationError((error as Error).message, 'FIRECRAWL_UNKNOWN_ERROR');

    await db('import_runs').where({ id: runId }).update({
      status: 'failed',
      completed_at: new Date(),
      request: JSON.stringify({
        ...request,
        error: {
          code: firecrawlError.code,
          message: firecrawlError.message,
          statusCode: firecrawlError.statusCode,
          retryable: firecrawlError.retryable,
          details: firecrawlError.details,
        },
      }),
    });
    console.error('[Firecrawl] Run failed:', firecrawlError);
  }
}
