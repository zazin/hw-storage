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

/**
 * Extract every useful field from an error for backend logging. AWS SDK errors
 * carry diagnostic detail (HTTP status, request id, error code, fault) on
 * non-enumerable properties that a plain `console.error(err)` or
 * `JSON.stringify` drops. This pulls them into a flat object so the full
 * picture lands in the logs.
 */
export function errorDetails(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { value: String(err) };
  }
  const e = err as Error & {
    code?: string;
    Code?: string;
    $fault?: string;
    $metadata?: {
      httpStatusCode?: number;
      requestId?: string;
      extendedRequestId?: string;
      cfId?: string;
      attempts?: number;
      totalRetryDelay?: number;
    };
    cause?: unknown;
  };
  return {
    name: e.name,
    message: e.message,
    code: e.code ?? e.Code,
    fault: e.$fault,
    httpStatusCode: e.$metadata?.httpStatusCode,
    requestId: e.$metadata?.requestId,
    extendedRequestId: e.$metadata?.extendedRequestId,
    attempts: e.$metadata?.attempts,
    totalRetryDelay: e.$metadata?.totalRetryDelay,
    cause: e.cause instanceof Error ? e.cause.message : e.cause,
    stack: e.stack,
  };
}

// Default to virtual-hosted style for Huawei OBS (production). MinIO
// (staging/local) needs path-style, so it must set S3_FORCE_PATH_STYLE=true.
export const forcePathStyle =
  (process.env.S3_FORCE_PATH_STYLE || "false").toLowerCase() === "true";

export const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  forcePathStyle,
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
      // A 403 on HeadBucket does not mean uploads will fail: some providers
      // (e.g. Huawei OBS) grant object-level permissions (PutObject/GetObject)
      // without bucket-level ones (HeadBucket/ListBucket). Don't block the
      // upload — let the actual operation surface the real error. We avoid
      // caching readiness so we retry the check on later requests.
      console.warn(
        `HeadBucket on "${BUCKET}" returned 403; proceeding without ` +
          `bucket-level confirmation. The upload will report the real error ` +
          `if credentials are genuinely insufficient.`,
      );
      return;
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
