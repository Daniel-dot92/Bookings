import { NextRequest, NextResponse } from "next/server";
import { getCalendar, getSheets } from "@/app/lib/google";
import { parseZoned } from "@/app/lib/datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  date: string;
  time: string;
  duration: string | number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  procedure: string;
  symptoms?: string;
};

async function readBody(req: NextRequest): Promise<Payload> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await req.json()) as Payload;
  const fd = await req.formData();
  const get = (k: string) => fd.get(k)?.toString() ?? "";
  return {
    date: get("date"),
    time: get("time"),
    duration: get("duration"),
    firstName: get("firstName"),
    lastName: get("lastName"),
    email: get("email"),
    phone: get("phone"),
    procedure: get("procedure"),
    symptoms: get("symptoms") || undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const calId = process.env.BOOKING_CALENDAR_ID;
    const useSA = String(process.env.USE_SERVICE_ACCOUNT).toLowerCase() === "true";
    if (!calId) return NextResponse.json({ error: "Липсва BOOKING_CALENDAR_ID." }, { status: 500 });
    if (useSA && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
      return NextResponse.json({ error: "Липсва GOOGLE_SERVICE_ACCOUNT_JSON_BASE64." }, { status: 500 });
    }

    const body = await readBody(req);
    const { date, time, duration, firstName, lastName, email, phone, procedure, symptoms } = body;

    if (!date || !time || !duration || !firstName || !lastName || !email || !phone || !procedure) {
      return NextResponse.json({ error: "Липсват задължителни полета." }, { status: 400 });
    }
    const dur = Number(duration);
    if (dur !== 30 && dur !== 60) return NextResponse.json({ error: "Невалидна продължителност (30|60)." }, { status: 400 });

    const startUtc = parseZoned(date, time);
    const endUtc = new Date(startUtc.getTime() + dur * 60 * 1000);

    const cal = getCalendar();
    const fb = await cal.freebusy.query({
      requestBody: { timeMin: startUtc.toISOString(), timeMax: endUtc.toISOString(), timeZone: "Europe/Sofia", items: [{ id: calId }] },
    });
    const busy = (fb.data.calendars?.[calId]?.busy as Array<{ start?: string | null; end?: string | null }> | undefined) || [];
    const overlaps = busy.some(b => startUtc < new Date(b.end ?? "") && endUtc > new Date(b.start ?? ""));
    if (overlaps) return NextResponse.json({ error: "Току-що се зае този интервал. Моля, изберете друг час." }, { status: 409 });

    const summary = `Резервация: ${firstName} ${lastName} – ${procedure} (${dur} мин)`;
    const description = `Име: ${firstName} ${lastName}
Имейл: ${email}
Телефон: ${phone}
Процедура: ${procedure}
Симптоми: ${symptoms || "—"}
Източник: Уебсайт`;

    const resIns = await cal.events.insert({
      calendarId: calId,
      requestBody: {
        summary,
        description,
        start: { dateTime: startUtc.toISOString(), timeZone: "Europe/Sofia" },
        end:   { dateTime: endUtc.toISOString(),   timeZone: "Europe/Sofia" },
        guestsCanInviteOthers: false,
        guestsCanModify: false,
        guestsCanSeeOtherGuests: false,
      },
    });

    const eventId = resIns.data.id || "";
    let sheetsOk = true, sheetsErr: string | undefined;

    try {
      const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID!;
      const sheetName = process.env.SHEETS_TAB_NAME || "Bookings";
      if (!spreadsheetId) throw new Error("Липсва SHEETS_SPREADSHEET_ID");

      const sheets = getSheets();
      const timestamp = new Intl.DateTimeFormat("bg-BG", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "Europe/Sofia",
      }).format(new Date());

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,       // ← достатъчно е A1 за append
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[
            timestamp, date, time, dur,
            firstName, lastName, email, phone,
            procedure, symptoms || "", eventId, "website",
          ]],
        },
      });
    } catch (err) {
      sheetsOk = false;
      sheetsErr = err instanceof Error ? err.message : String(err);
      console.error("[BOOK] Sheets append failed:", sheetsErr);
    }

    return NextResponse.json({ ok: true, eventId, sheetsOk, sheetsErr });
  } catch (e) {
    console.error("[BOOK] ERROR:", e);
    const message = e instanceof Error ? e.message : "Грешка при записването.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
