import { env } from '../../config/env';
import { LocalStorageProvider } from './localProvider';
import { NetlifyBlobStorageProvider } from './netlifyBlobProvider';
import type { StorageProvider } from './types';

function resolveBackend(): 'local' | 'netlify-blobs' {
  const fromProcess = process.env.STORAGE_BACKEND;
  if (fromProcess === 'local' || fromProcess === 'netlify-blobs') {
    return fromProcess;
  }
  if (env.STORAGE_BACKEND) {
    return env.STORAGE_BACKEND;
  }
  if (process.env.NETLIFY === 'true' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return 'netlify-blobs';
  }
  return 'local';
}

let cachedProvider: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (!cachedProvider) {
    const backend = resolveBackend();
    cachedProvider =
      backend === 'netlify-blobs'
        ? new NetlifyBlobStorageProvider()
        : new LocalStorageProvider();
  }
  return cachedProvider;
}

export function resetStorageProviderForTests(): void {
  cachedProvider = undefined;
}
