import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../shared/config.js';
import { Readable } from 'stream';

export interface ObjectStorageService {
  ensureBucket(): Promise<void>;
  putObject(key: string, data: Buffer | string, contentType?: string): Promise<string>;
  getObject(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export class S3CompatibleStorageService implements ObjectStorageService {
  private client: S3Client;
  private bucket: string;
  private bucketEnsured: boolean = false;

  constructor() {
    this.bucket = config.objectStorage.bucket;
    this.client = new S3Client({
      endpoint: config.objectStorage.endpoint,
      region: config.objectStorage.region,
      credentials: {
        accessKeyId: config.objectStorage.accessKey,
        secretAccessKey: config.objectStorage.secretKey,
      },
      forcePathStyle: config.objectStorage.forcePathStyle,
    });
  }

  async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketEnsured = true;
    } catch (err: any) {
      const statusCode = err?.$metadata?.httpStatusCode;
      if (statusCode === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchBucket') {
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          this.bucketEnsured = true;
        } catch (createErr: any) {
          throw new Error(`Failed to create S3 bucket ${this.bucket}: ${createErr?.message || createErr}`);
        }
      } else {
        throw new Error(`S3 bucket check failed (${config.objectStorage.endpoint}): ${err?.message || err}`);
      }
    }
  }

  async putObject(
    key: string,
    data: Buffer | string,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    const buf = typeof data === 'string' ? Buffer.from(data) : data;
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buf,
        ContentType: contentType,
      })
    );
    return `${config.objectStorage.endpoint}/${this.bucket}/${key}`;
  }

  async getObject(key: string): Promise<Buffer> {
    await this.ensureBucket();
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
    if (response.Body) {
      if (response.Body instanceof Readable) {
        const chunks: Buffer[] = [];
        for await (const chunk of response.Body) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        return Buffer.concat(chunks);
      } else if (typeof (response.Body as any).transformToByteArray === 'function') {
        const byteArray = await (response.Body as any).transformToByteArray();
        return Buffer.from(byteArray);
      }
    }
    throw new Error(`Empty body for key ${key}`);
  }

  async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    await this.ensureBucket();
    return await awsGetSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds }
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }
}

export const storage = new S3CompatibleStorageService();
