
// app/api/debug-env/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    USE_SERVICE_ACCOUNT: String(process.env.USE_SERVICE_ACCOUNT).toLowerCase() === "true",
    HAS_SA_JSON: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64),
    BOOKING_CALENDAR_ID_STUDENTSKI: Boolean(
      process.env.BOOKING_CALENDAR_ID_STUDENTSKI || process.env.BOOKING_CALENDAR_ID
    ),
    BOOKING_CALENDAR_ID_MLADOST: Boolean(process.env.BOOKING_CALENDAR_ID_MLADOST),
    SHEETS_SPREADSHEET_ID: Boolean(process.env.SHEETS_SPREADSHEET_ID),
    SHEETS_TAB_NAME: process.env.SHEETS_TAB_NAME || "Bookings",
    SHEETS_SPREADSHEET_ID_STUDENTSKI: Boolean(
      process.env.SHEETS_SPREADSHEET_ID_STUDENTSKI || process.env.SHEETS_SPREADSHEET_ID
    ),
    SHEETS_SPREADSHEET_ID_MLADOST: Boolean(
      process.env.SHEETS_SPREADSHEET_ID_MLADOST || process.env.SHEETS_SPREADSHEET_ID
    ),
    SHEETS_TAB_NAME_STUDENTSKI:
      process.env.SHEETS_TAB_NAME_STUDENTSKI || process.env.SHEETS_TAB_NAME || "Bookings",
    SHEETS_TAB_NAME_MLADOST:
      process.env.SHEETS_TAB_NAME_MLADOST || "Bookings - Mladost 1A",
    REVIEW_SMS_SHEET_TAB_STUDENTSKI:
      process.env.REVIEW_SMS_SHEET_TAB_STUDENTSKI ||
      process.env.REVIEW_SMS_SHEET_TAB ||
      "Имена и тел",
    REVIEW_SMS_SHEET_TAB_MLADOST:
      process.env.REVIEW_SMS_SHEET_TAB_MLADOST || "Имена и тел - Младост 1А",
  });
}
