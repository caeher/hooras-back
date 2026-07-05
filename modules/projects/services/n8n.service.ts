import { env } from '../../../config/env';

export interface PublicProjectPayload {
  id: string;
  title: string;
  description: string;
  organizationName: string;
  location?: string;
  modality?: string;
  categories: string[];
  applicationDeadline?: string;
}

interface N8nWebhookResponse {
  statusCode: number;
  body?: unknown;
}

interface N8nErrorDetails {
  statusCode?: number;
  responseBody?: unknown;
  retryable?: boolean;
}

export class N8nIntegrationError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(message: string, code: string, details: N8nErrorDetails = {}) {
    super(message);
    this.name = 'N8nIntegrationError';
    this.code = code;
    this.statusCode = details.statusCode;
    this.retryable = details.retryable ?? false;
    this.details = details.responseBody;
  }
}

export function assertN8nConfigured(): void {
  if (!env.N8N_WEBHOOK_URL) {
    throw new N8nIntegrationError(
      'N8N_WEBHOOK_URL is required to trigger n8n workflows',
      'N8N_NOT_CONFIGURED'
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function postN8nWebhook(payload: unknown, attempt = 0): Promise<N8nWebhookResponse> {
  assertN8nConfigured();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.N8N_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (env.N8N_API_KEY) {
      headers['X-N8N-API-KEY'] = env.N8N_API_KEY;
    }

    const response = await fetch(env.N8N_WEBHOOK_URL!, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const responseBody = await readResponseBody(response);

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < env.N8N_MAX_RETRIES) {
        await sleep(500 * (attempt + 1));
        return postN8nWebhook(payload, attempt + 1);
      }

      throw new N8nIntegrationError(
        `n8n webhook failed with status ${response.status}`,
        'N8N_HTTP_ERROR',
        { statusCode: response.status, responseBody, retryable }
      );
    }

    return { statusCode: response.status, body: responseBody };
  } catch (error) {
    if (error instanceof N8nIntegrationError) throw error;
    if ((error as Error).name === 'AbortError') {
      const retryable = attempt < env.N8N_MAX_RETRIES;
      if (retryable) {
        await sleep(500 * (attempt + 1));
        return postN8nWebhook(payload, attempt + 1);
      }

      throw new N8nIntegrationError(
        `n8n webhook timed out after ${env.N8N_TIMEOUT_MS}ms`,
        'N8N_TIMEOUT',
        { retryable: true }
      );
    }

    const retryable = attempt < env.N8N_MAX_RETRIES;
    if (retryable) {
      await sleep(500 * (attempt + 1));
      return postN8nWebhook(payload, attempt + 1);
    }

    throw new N8nIntegrationError(
      `n8n webhook request failed: ${(error as Error).message}`,
      'N8N_REQUEST_FAILED',
      { retryable: true }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function triggerProjectPostedWorkflow(project: PublicProjectPayload): Promise<N8nWebhookResponse> {
  const payload = {
    event: 'project.published',
    project,
    timestamp: new Date().toISOString(),
  };

  return postN8nWebhook(payload);
}
