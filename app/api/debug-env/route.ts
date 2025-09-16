
// app/api/debug-env/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    USE_SERVICE_ACCOUNT: "true",
    HAS_SA_JSON: true,
    BOOKING_CALENDAR_ID: true,
    SHEETS_SPREADSHEET_ID:"12BbJD7D1PCS5tcGSiihl22a8Nng8Hkvid2vcgRLnEA4",
    SHEETS_TAB_NAME: "Bookings",
  });
}
