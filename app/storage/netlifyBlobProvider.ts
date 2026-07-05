import { getStore } from '@netlify/blobs';
import type { SaveResult, StorageProvider, StoredFile } from './types';
import { buildStorageRef, guessMimeType } from './safeFileName';

const STORE_NAME = 'hooras-uploads';

export class NetlifyBlobStorageProvider implements StorageProvider {
  private getStore() {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  }

  async save(
    buffer: Buffer,
    originalName: string,
    subfolder: string,
    mimeType?: string,
  ): Promise<SaveResult> {
    const { storageRef, fileName } = buildStorageRef(originalName, subfolder);
    const store = this.getStore();
    await store.set(
      storageRef,
      new Blob([buffer], { type: mimeType ?? 'application/octet-stream' }),
      {
      metadata: {
        originalName,
        ...(mimeType ? { contentType: mimeType } : {}),
      },
    });
    return { storageRef, fileName };
  }

  async get(storageRef: string): Promise<StoredFile | null> {
    const store = this.getStore();
    const result = await store.getWithMetadata(storageRef, { type: 'blob' });
    if (!result) return null;

    const contentType = result.metadata?.contentType;
    const mimeType =
      typeof contentType === 'string' ? contentType : guessMimeType(storageRef);

    const buffer = Buffer.from(await result.data.arrayBuffer());
    return { buffer, mimeType };
  }
}
