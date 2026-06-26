import {
  S3Client,
  HeadBucketCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Thrown when the configured bucket is missing or not accessible. This app has
 * no permission to create or manage buckets, so the bucket must be provisioned
 * out-of-band by an operator.
 */
export class BucketUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BucketUnavailableError";
  }
}

export const BUCKET = process.env.S3_BUCKET || "images";

export const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  // Required for MinIO and other S3-compatible servers.
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
  },
});

let bucketReady = false;

/**
 * Verify the target bucket exists and is reachable. This app does not have
 * permission to create or manage buckets, so it only checks — it never creates.
 * Throws {@link BucketUnavailableError} with a clear message when the bucket is
 * missing or inaccessible. Safe to call on every request.
 */
export async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch (err: unknown) {
    const status =
      (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode ?? 0;
    const name = (err as { name?: string })?.name ?? "";

    if (status === 404 || name === "NotFound" || name === "NoSuchBucket") {
      throw new BucketUnavailableError(
        `Bucket "${BUCKET}" does not exist. This app cannot create buckets — ` +
          `please ask an administrator to create it.`,
      );
    }
    if (status === 403 || name === "Forbidden" || name === "AccessDenied") {
      throw new BucketUnavailableError(
        `Access to bucket "${BUCKET}" was denied. Check the configured ` +
          `credentials and bucket permissions.`,
      );
    }
    throw new BucketUnavailableError(
      `Bucket "${BUCKET}" is not available: ${String(err)}`,
    );
  }
  bucketReady = true;
}

/**
 * Generate a time-limited presigned GET URL for an object. The browser can use
 * this to download directly from MinIO without going through the app.
 */
export async function presignDownload(
  key: string,
  filename: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
    }),
    { expiresIn },
  );
}
