// app/api/test-sheets/route.ts
import { NextResponse } from "next/server";
import { getSheets } from "@/app/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID!;
    const sheetName = process.env.SHEETS_TAB_NAME || "Bookings";
    const sheets = getSheets();

    const stamp = new Intl.DateTimeFormat("bg-BG", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "Europe/Sofia",
    }).format(new Date());

    const resp = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[stamp, "TEST", "00:00", 30, "Test", "Row", "test@example.com", "000", "proc", "sym", "test-event", "api/test-sheets"]],
      },
    });

    return NextResponse.json({ ok: true, updates: resp.data.updates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[TEST-SHEETS] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
