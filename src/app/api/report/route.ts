import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

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

export async function GET() {
  try {
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
        date: new Date(base - rand(90) * 86400000)
          .toISOString()
          .slice(0, 10),
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="report.xlsx"',
      },
    });
  } catch (err) {
    console.error("report failed", err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
