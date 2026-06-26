import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { s3, BUCKET, ensureBucket, BucketUnavailableError } from "@/lib/s3";
import { insertImage, type ImageRecord } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const contentType = file.type || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 },
      );
    }

    await ensureBucket();

    const id = randomUUID();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const key = `${id}-${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );

    const record: ImageRecord = {
      id,
      key,
      filename: file.name,
      content_type: contentType,
      size: bytes.length,
      created_at: new Date().toISOString(),
    };
    insertImage(record);

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof BucketUnavailableError) {
      console.error("upload failed: bucket unavailable", err.message);
      return NextResponse.json(
        { error: "Storage unavailable", detail: err.message },
        { status: 503 },
      );
    }
    console.error("upload failed", err);
    return NextResponse.json(
      { error: "Upload failed", detail: String(err) },
      { status: 500 },
    );
  }
}
