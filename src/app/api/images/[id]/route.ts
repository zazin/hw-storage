import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { s3, BUCKET } from "@/lib/s3";
import { getImage } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const record = getImage(id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: record.key }),
    );
    const body = Readable.toWeb(
      obj.Body as Readable,
    ) as ReadableStream<Uint8Array>;

    return new Response(body, {
      headers: {
        "Content-Type": record.content_type,
        "Content-Length": String(record.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("view failed", err);
    return NextResponse.json({ error: "Failed to fetch object" }, { status: 500 });
  }
}
