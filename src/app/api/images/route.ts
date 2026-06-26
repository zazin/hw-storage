import { NextResponse } from "next/server";
import { listImages } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(listImages());
  } catch (err) {
    console.error("list failed", err);
    return NextResponse.json(
      { error: "Failed to list images" },
      { status: 500 },
    );
  }
}
