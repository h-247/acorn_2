import { config } from '../../shared/config.js';

export interface ObjectStorageService {
  putObject(key: string, data: Buffer | string, contentType?: string): Promise<string>;
  getObject(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export class S3CompatibleStorageService implements ObjectStorageService {
  private inMemoryStore = new Map<string, { data: Buffer; contentType: string }>();

  async putObject(key: string, data: Buffer | string, contentType: string = 'application/octet-stream'): Promise<string> {
    const buf = typeof data === 'string' ? Buffer.from(data) : data;
    this.inMemoryStore.set(key, { data: buf, contentType });
    return `${config.objectStorage.endpoint}/${config.objectStorage.bucket}/${key}`;
  }

  async getObject(key: string): Promise<Buffer> {
    const item = this.inMemoryStore.get(key);
    if (!item) {
      throw new Error(`Object with key ${key} not found in storage.`);
    }
    return item.data;
  }

  async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    return `${config.objectStorage.endpoint}/${config.objectStorage.bucket}/${key}?signed=true&expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  async deleteObject(key: string): Promise<void> {
    this.inMemoryStore.delete(key);
  }
}

export const storage = new S3CompatibleStorageService();
