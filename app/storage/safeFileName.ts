import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export function buildStorageRef(originalName: string, subfolder: string): {
  storageRef: string;
  fileName: string;
} {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${uuidv4()}-${safeName}`;
  const storageRef = join(subfolder, fileName).replace(/\\/g, '/');
  return { storageRef, fileName: safeName };
}

export function guessMimeType(storageRef: string): string {
  const lower = storageRef.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}
