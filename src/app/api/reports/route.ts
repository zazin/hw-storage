import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET, ensureBucket, presignDownload } from "@/lib/s3";
import { insertReport, listReports, type ReportRecord } from "@/lib/db";

export const runtime = "nodejs";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const NAMES = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
  "Golf",
  "Hotel",
];
const CATEGORIES = ["Electronics", "Food", "Apparel", "Toys", "Books", "Tools"];
const REGIONS = ["North", "South", "East", "West", "Central"];

function rand(n: number) {
  return Math.floor(Math.random() * n);
}

async function buildReport(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "hw-storage POC";
  const ws = wb.addWorksheet("Report");

  ws.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Name", key: "name", width: 20 },
    { header: "Category", key: "category", width: 16 },
    { header: "Region", key: "region", width: 12 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Quantity", key: "quantity", width: 12 },
    { header: "Date", key: "date", width: 14 },
  ];
  ws.getRow(1).font = { bold: true };

  const base = Date.now();
  for (let i = 1; i <= 50; i++) {
    ws.addRow({
      id: i,
      name: `${NAMES[rand(NAMES.length)]}-${rand(1000)}`,
      category: CATEGORIES[rand(CATEGORIES.length)],
      region: REGIONS[rand(REGIONS.length)],
      amount: Number((Math.random() * 10000).toFixed(2)),
      quantity: rand(500) + 1,
      date: new Date(base - rand(90) * 86400000).toISOString().slice(0, 10),
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// POST: generate a report, store it in object storage, return a download link.
export async function POST() {
  try {
    await ensureBucket();

    const buffer = await buildReport();
    const id = randomUUID();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `report-${stamp}.xlsx`;
    const key = `reports/${id}.xlsx`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: XLSX_TYPE,
      }),
    );

    const record: ReportRecord = {
      id,
      key,
      filename,
      size: buffer.length,
      created_at: new Date().toISOString(),
    };
    insertReport(record);

    const url = await presignDownload(key, filename);
    return NextResponse.json({ ...record, url }, { status: 201 });
  } catch (err) {
    console.error("report generation failed", err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}

// GET: list previously generated reports, each with a fresh presigned link.
export async function GET() {
  try {
    const reports = listReports();
    const withUrls = await Promise.all(
      reports.map(async (r) => ({
        ...r,
        url: await presignDownload(r.key, r.filename),
      })),
    );
    return NextResponse.json(withUrls);
  } catch (err) {
    console.error("report list failed", err);
    return NextResponse.json(
      { error: "Failed to list reports" },
      { status: 500 },
    );
  }
}
