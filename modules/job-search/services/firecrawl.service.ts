import { env } from '../../../config/env';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobSearchOptions {
  query: string;
  categories?: string[];
  location?: string;
  limit?: number;
}

export interface JobSearchResult {
  title: string;
  url: string;
  description: string;
  company: string;
  location?: string;
  categories: string[];
  contactInfo?: ContactInfo;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  website?: string;
  contactPage?: string;
}

export class FirecrawlServiceError extends Error {
  readonly code: string;
  readonly statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = 'FirecrawlServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertApiKeyConfigured(): void {
  if (!env.FIRECRAWL_API_KEY) {
    throw new FirecrawlServiceError(
      'FIRECRAWL_API_KEY is not configured. Please set it in your environment to use job search.',
      'FIRECRAWL_NOT_CONFIGURED',
      503,
    );
  }
}

async function firecrawlRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  assertApiKeyConfigured();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.FIRECRAWL_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.FIRECRAWL_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new FirecrawlServiceError(
        `Firecrawl API error: ${response.status}`,
        'FIRECRAWL_HTTP_ERROR',
        response.status,
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof FirecrawlServiceError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new FirecrawlServiceError(
        `Firecrawl request timed out after ${env.FIRECRAWL_TIMEOUT_MS}ms`,
        'FIRECRAWL_TIMEOUT',
        504,
      );
    }
    throw new FirecrawlServiceError(
      `Firecrawl request failed: ${(error as Error).message}`,
      'FIRECRAWL_REQUEST_FAILED',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Normalise search results from Firecrawl's /search response
// ---------------------------------------------------------------------------

interface FirecrawlSearchItem {
  title?: string;
  url?: string;
  description?: string;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    ogDescription?: string;
    sourceURL?: string;
  };
}

interface FirecrawlSearchResponse {
  success: boolean;
  data?: FirecrawlSearchItem[];
  results?: FirecrawlSearchItem[];
}

function normaliseSearchResults(
  raw: FirecrawlSearchResponse,
  opts: JobSearchOptions,
): JobSearchResult[] {
  const items: FirecrawlSearchItem[] = raw.data ?? raw.results ?? [];

  return items.map((item) => {
    const url = item.url ?? item.metadata?.sourceURL ?? '';
    const domain = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return url;
      }
    })();

    return {
      title: item.title ?? item.metadata?.title ?? 'Job Offer',
      url,
      description:
        item.description ??
        item.metadata?.description ??
        item.metadata?.ogDescription ??
        (item.markdown ? item.markdown.slice(0, 300) : ''),
      company: domain,
      location: opts.location,
      categories: opts.categories ?? [],
    };
  });
}

// ---------------------------------------------------------------------------
// Normalise scrape result for contact info
// ---------------------------------------------------------------------------

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      sourceURL?: string;
    };
  };
}

function extractContactInfo(raw: FirecrawlScrapeResponse, pageUrl: string): ContactInfo {
  const content = raw.data?.markdown ?? raw.data?.html ?? '';
  const info: ContactInfo = { website: pageUrl };

  // Email regex
  const emailMatch = content.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) info.email = emailMatch[0];

  // Phone regex — covers common formats
  const phoneMatch = content.match(
    /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}/,
  );
  if (phoneMatch) info.phone = phoneMatch[0].trim();

  // Contact page link
  const contactPageMatch = content.match(/https?:\/\/[^\s"')]+(?:contact|contacto|about)[^\s"')]+/i);
  if (contactPageMatch) info.contactPage = contactPageMatch[0];

  return info;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search job listings using Firecrawl's /search endpoint.
 * The query is automatically enriched with location/category context.
 */
export async function searchJobs(opts: JobSearchOptions): Promise<JobSearchResult[]> {
  const categoryClause = opts.categories?.length
    ? ` in ${opts.categories.join(' or ')}`
    : '';
  const locationClause = opts.location ? ` in ${opts.location}` : '';
  const enrichedQuery = `${opts.query}${categoryClause} job offer${locationClause} site:linkedin.com OR site:indeed.com OR site:glassdoor.com OR site:computrabajo.com`;

  const raw = await firecrawlRequest<FirecrawlSearchResponse>('/search', {
    query: enrichedQuery,
    limit: Math.min(opts.limit ?? env.FIRECRAWL_MAX_RESULTS, 25),
    scrapeOptions: {
      formats: ['markdown'],
    },
  });

  return normaliseSearchResults(raw, opts);
}

/**
 * Scrape a specific URL to extract contact information.
 */
export async function scrapeContactInfo(url: string): Promise<ContactInfo> {
  const raw = await firecrawlRequest<FirecrawlScrapeResponse>('/scrape', {
    url,
    formats: ['markdown'],
  });

  return extractContactInfo(raw, url);
}
