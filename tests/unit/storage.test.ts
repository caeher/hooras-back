import { afterEach, describe, expect, it } from 'vitest';
import { getStorageProvider, resetStorageProviderForTests } from '../../app/storage/getStorageProvider';
import { LocalStorageProvider } from '../../app/storage/localProvider';
import { NetlifyBlobStorageProvider } from '../../app/storage/netlifyBlobProvider';

describe('storage provider', () => {
  const originalNetlify = process.env.NETLIFY;
  const originalLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;
  const originalBackend = process.env.STORAGE_BACKEND;

  afterEach(() => {
    if (originalNetlify === undefined) delete process.env.NETLIFY;
    else process.env.NETLIFY = originalNetlify;
    if (originalLambda === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    else process.env.AWS_LAMBDA_FUNCTION_NAME = originalLambda;
    process.env.STORAGE_BACKEND = originalBackend ?? 'local';
    resetStorageProviderForTests();
  });

  it('uses local provider by default in tests', () => {
    delete process.env.NETLIFY;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.STORAGE_BACKEND;
    resetStorageProviderForTests();
    expect(getStorageProvider()).toBeInstanceOf(LocalStorageProvider);
  });

  it('uses netlify blobs when configured explicitly', () => {
    process.env.STORAGE_BACKEND = 'netlify-blobs';
    resetStorageProviderForTests();
    expect(getStorageProvider()).toBeInstanceOf(NetlifyBlobStorageProvider);
  });
});

describe('serverless-safe storage imports', () => {
  it('loads multer config without eager filesystem writes', async () => {
    const mod = await import('../../app/storage/multerConfig');
    expect(mod.uploadMiddleware).toBeDefined();
    expect(mod.persistUploadedFile).toBeTypeOf('function');
  });
});
