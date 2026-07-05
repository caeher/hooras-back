import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { SaveResult, StorageProvider, StoredFile } from './types';
import { buildStorageRef, guessMimeType } from './safeFileName';

const UPLOADS_DIR = join(process.cwd(), 'uploads');

export class LocalStorageProvider implements StorageProvider {
  async save(
    buffer: Buffer,
    originalName: string,
    subfolder: string,
    mimeType?: string,
  ): Promise<SaveResult> {
    const { storageRef, fileName } = buildStorageRef(originalName, subfolder);
    const dir = join(UPLOADS_DIR, subfolder);
    await mkdir(dir, { recursive: true });
    await writeFile(join(UPLOADS_DIR, storageRef), buffer);
    if (mimeType) {
      await writeFile(`${join(UPLOADS_DIR, storageRef)}.meta.json`, JSON.stringify({ mimeType }));
    }
    return { storageRef, fileName };
  }

  async get(storageRef: string): Promise<StoredFile | null> {
    const filePath = join(UPLOADS_DIR, storageRef);
    try {
      const buffer = await readFile(filePath);
      let mimeType = guessMimeType(storageRef);
      try {
        const meta = JSON.parse(
          await readFile(`${filePath}.meta.json`, 'utf8'),
        ) as { mimeType?: string };
        if (meta.mimeType) mimeType = meta.mimeType;
      } catch {
        // no sidecar metadata
      }
      return { buffer, mimeType };
    } catch {
      return null;
    }
  }
}

export { UPLOADS_DIR };
