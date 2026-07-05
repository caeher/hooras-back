import { env } from './env';

/**
 * Public URL of this API. On Netlify, `URL` is injected automatically at runtime.
 */
export function resolvePublicBaseUrl(): string {
  const fromNetlify = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  if (fromNetlify) {
    return fromNetlify.replace(/\/$/, '');
  }
  return env.BASE_URL.replace(/\/$/, '');
}
