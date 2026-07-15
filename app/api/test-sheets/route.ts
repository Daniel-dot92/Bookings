// app/api/test-sheets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isOfficeKey } from "@/app/lib/booking-config";
import { getSheets } from "@/app/lib/google";
import {
  BOOKING_SHEET_HEADERS,
  ensureSheetWithHeaders,
  getSheetConfigForOffice,
} from "@/app/lib/sheets-config.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const officeParam = searchParams.get("office");
    const officeKey = isOfficeKey(officeParam)
      ? officeParam
      : "studentski-grad";
    const sheetConfig = getSheetConfigForOffice(officeKey);
    const spreadsheetId = sheetConfig.spreadsheetId;
    const sheetName = sheetConfig.bookingTabName;
    if (!spreadsheetId) {
      throw new Error(`Missing spreadsheet config for ${officeKey}`);
    }

    const sheets = getSheets();

    const stamp = new Intl.DateTimeFormat("bg-BG", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "Europe/Sofia",
    }).format(new Date());

    await ensureSheetWithHeaders(sheets, spreadsheetId, sheetName, BOOKING_SHEET_HEADERS);

    const resp = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          stamp,
          "TEST",
          "00:00",
          30,
          "Test",
          "Row",
          "test@example.com",
          "000",
          "proc",
          "sym",
          "test-event",
          "Test therapist",
          officeKey,
          "api/test-sheets",
        ]],
      },
    });

    return NextResponse.json({
      ok: true,
      officeKey,
      spreadsheetId,
      sheetName,
      updates: resp.data.updates,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[TEST-SHEETS] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
