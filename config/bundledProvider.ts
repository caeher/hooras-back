import { resolvePublicBaseUrl } from './publicUrl';

export function isLocalhostUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function resolveBundledApiBaseUrl(path: string, configured?: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const bundledUrl = `${resolvePublicBaseUrl()}${normalizedPath}`.replace(/\/$/, '');
  if (!configured) return bundledUrl;

  if (isLocalhostUrl(configured)) {
    return bundledUrl;
  }

  try {
    new URL(configured);
    return configured.replace(/\/$/, '');
  } catch {
    return bundledUrl;
  }
}

export function usesBundledApiBaseUrl(configuredBaseUrl: string, path: string): boolean {
  return configuredBaseUrl === resolveBundledApiBaseUrl(path);
}
