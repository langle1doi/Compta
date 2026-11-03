import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpStatus, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';

/** Objects of a tenant always live under this prefix, so one tenant can never be handed the key of another. */
export function tenantObjectKey(tenantId: string, relativePath: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('Invalid tenant id');
  const clean = relativePath.replace(/^\/+/, '');
  if (!clean || clean.split('/').some((part) => part === '..' || part === '.' || part === '')) throw new Error('Invalid object path');
  return `tenants/${tenantId}/${clean}`;
}

const PROBE_TIMEOUT_MS = 2_000;
const STATUS_TTL_MS = 10_000;

const httpStatusOf = (error: unknown) => (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;

/** Data exports of a tenant, under its prefix. */
export const TENANT_EXPORTS_DIR = 'exports';

/** Everything a tenant has in storage, for usage counting and purge. */
export function tenantPrefix(tenantId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('Invalid tenant id');
  return `tenants/${tenantId}/`;
}

/** S3-compatible object storage (MinIO). Downloads go through short-lived presigned URLs. */
@Injectable()
export class StorageService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  // Signs with the address the browser uses: the signature covers the host
  private readonly signer: S3Client;
  private readonly bucket: string;
  private bucketReady = false;
  private available = true;
  private checkedAt = 0;
  private refreshing?: Promise<void>;

  constructor(config: ConfigService) {
    const base = {
      region: config.getOrThrow<string>('S3_REGION'),
      forcePathStyle: true,
      credentials: { accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'), secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY') },
    };
    const endpoint = config.getOrThrow<string>('S3_ENDPOINT');
    this.client = new S3Client({ ...base, endpoint });
    this.signer = new S3Client({ ...base, endpoint: config.get<string>('S3_PUBLIC_ENDPOINT') || endpoint });
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
  }

  /** MinIO may still be starting: not fatal, the status and the next use try again. */
  async onApplicationBootstrap() {
    await this.refreshStatus();
  }

  onModuleDestroy() {
    this.client.destroy();
    this.signer.destroy();
  }

  /**
   * Last known state, for readiness and metrics. Refreshed behind the scenes so a server that hangs never holds a probe
   * up; so it can lag by up to STATUS_TTL_MS.
   */
  isAvailable(): boolean {
    if (Date.now() - this.checkedAt >= STATUS_TTL_MS) void this.refreshStatus();
    return this.available;
  }

  private refreshStatus(): Promise<void> {
    this.refreshing ??= this.probe()
      .then((up) => this.setAvailable(up))
      .finally(() => (this.refreshing = undefined));
    return this.refreshing;
  }

  /** Also creates the bucket if MinIO only came up after this process did. */
  private async probe(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), { abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      this.bucketReady = true;
      return true;
    } catch (error) {
      if (httpStatusOf(error) !== 404) return false;
      this.bucketReady = false;
      return this.ensureBucket().then(
        () => true,
        () => false,
      );
    }
  }

  private setAvailable(up: boolean) {
    this.checkedAt = Date.now();
    if (up !== this.available) {
      if (up) this.logger.log('Object storage is reachable again');
      else this.logger.warn('Object storage is not reachable');
    }
    this.available = up;
  }

  /** A feature that needs a file gets a clear, retryable answer, not a raw connection error. */
  private async guarded<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const status = httpStatusOf(error);
      if (status !== undefined && status < 500) throw error;
      this.setAvailable(false);
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.STORAGE_UNAVAILABLE,
        'File storage is not available, try again shortly',
      );
    }
  }

  async ensureBucket() {
    if (this.bucketReady) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (httpStatusOf(error) !== 404) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket })).catch((createError: { name?: string }) => {
        // Another pod created it first
        if (createError.name !== 'BucketAlreadyOwnedByYou' && createError.name !== 'BucketAlreadyExists') throw createError;
      });
      this.logger.log(`Created bucket ${this.bucket}`);
    }
    this.bucketReady = true;
  }

  async putBuffer(key: string, body: Buffer, contentType: string) {
    await this.guarded(async () => {
      await this.ensureBucket();
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
    });
  }

  async putFile(key: string, path: string, contentType: string) {
    const { size } = await stat(path);
    await this.guarded(async () => {
      await this.ensureBucket();
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: createReadStream(path),
          ContentLength: size,
          ContentType: contentType,
        }),
      );
    });
    return size;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.guarded(() => this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })));
      return true;
    } catch (error) {
      if (httpStatusOf(error) === 404) return false;
      throw error;
    }
  }

  async delete(key: string) {
    await this.guarded(() => this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })));
  }

  /** Bytes that count against the tenant's plan. Its own data exports do not: they are copies made by the platform. */
  async tenantUsage(tenantId: string): Promise<number> {
    const prefix = tenantPrefix(tenantId);
    let total = 0;
    for await (const page of this.listPages(prefix)) {
      for (const object of page) if (!object.Key?.startsWith(`${prefix}${TENANT_EXPORTS_DIR}/`)) total += object.Size ?? 0;
    }
    return total;
  }

  async deletePrefix(prefix: string) {
    for await (const page of this.listPages(prefix)) {
      const objects = page.flatMap((object) => (object.Key ? [{ Key: object.Key }] : []));
      if (objects.length > 0)
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects, Quiet: true } }));
    }
  }

  private async *listPages(prefix: string) {
    await this.ensureBucket();
    let token: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      yield page.Contents ?? [];
      token = page.NextContinuationToken;
    } while (token);
  }

  /** Download link that stops working after `expiresInSeconds`. */
  presignedDownloadUrl(key: string, expiresInSeconds: number, fileName?: string): Promise<string> {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(fileName && { ResponseContentDisposition: `attachment; filename="${fileName.replace(/[^\w.-]/g, '_')}"` }),
      }),
      { expiresIn: expiresInSeconds },
    );
  }
}
