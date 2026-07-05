import multer from 'multer';
import type { Express } from 'express';
import { getStorageProvider } from './getStorageProvider';
import type { SaveResult } from './types';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export async function persistUploadedFile(
  file: Express.Multer.File,
  subfolder = 'files',
): Promise<SaveResult> {
  const provider = getStorageProvider();
  return provider.save(file.buffer, file.originalname, subfolder, file.mimetype);
}
