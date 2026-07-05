export interface SaveResult {
  storageRef: string;
  fileName: string;
}

export interface StoredFile {
  buffer: Buffer;
  mimeType: string;
}

export interface StorageProvider {
  save(
    buffer: Buffer,
    originalName: string,
    subfolder: string,
    mimeType?: string,
  ): Promise<SaveResult>;
  get(storageRef: string): Promise<StoredFile | null>;
}
