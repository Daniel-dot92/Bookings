// app/api/book/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCalendar, getSheets } from "@/app/lib/google";
import { parseZoned } from "@/app/lib/datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  date: string;               // "YYYY-MM-DD"
  time: string;               // "HH:mm"
  duration: string | number;  // 30 | 60 | 90
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  procedure: string;
  symptoms?: string;
};

// Приемаме JSON или form-data
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
    if (!calId) {
      return NextResponse.json({ ok: false, error: "Липсва BOOKING_CALENDAR_ID." }, { status: 500 });
    }
    if (useSA && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
      return NextResponse.json({ ok: false, error: "Липсва GOOGLE_SERVICE_ACCOUNT_JSON_BASE64." }, { status: 500 });
    }

    const body = await readBody(req);
    const { date, time, duration, firstName, lastName, email, phone, procedure, symptoms } = body;

    // Валидации
    if (!date || !time || !duration || !firstName || !lastName || !email || !phone || !procedure) {
      return NextResponse.json({ ok: false, error: "Липсват задължителни полета." }, { status: 400 });
    }

    const dur = Number(duration);
    if (![30, 60, 90].includes(dur)) {
      return NextResponse.json({ ok: false, error: "Невалидна продължителност (30|60|90)." }, { status: 400 });
    }

    // Неделя – почивен ден
    const dNoon = parseZoned(date, "12:00");
    const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Sofia" }).format(dNoon);
    if (wd === "Sun") {
      return NextResponse.json({ ok: false, error: "Неделя е почивен ден. Моля, изберете друга дата." }, { status: 400 });
    }

    // Начало/край в Europe/Sofia (parseZoned ти връща правилен Date за зоната)
    const startUtc = parseZoned(date, time);
    const endUtc = new Date(startUtc.getTime() + dur * 60 * 1000);

    const cal = getCalendar();

    // Проверка за заетост
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: startUtc.toISOString(),
        timeMax: endUtc.toISOString(),
        timeZone: "Europe/Sofia",
        items: [{ id: calId }],
      },
    });
    const busy =
      (fb.data.calendars?.[calId]?.busy as Array<{ start?: string | null; end?: string | null }> | undefined) || [];
    const overlaps = busy.some((b) => {
      const bStart = new Date(b.start ?? "");
      const bEnd = new Date(b.end ?? "");
      return startUtc < bEnd && endUtc > bStart;
    });
    if (overlaps) {
      return NextResponse.json(
        { ok: false, error: "Този интервал току-що беше зает. Моля, изберете друг час." },
        { status: 409 }
      );
    }

    // Създаваме събитие
    const summary = `Резервация: ${firstName} ${lastName} – ${procedure} (${dur} мин)`;
    const description = `Име: ${firstName} ${lastName}
Имейл: ${email}
Телефон: ${phone}
Процедура: ${procedure}
Симптоми: ${symptoms || "—"}
Източник: Уебсайт`;

    const created = await cal.events.insert({
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

    const eventId = created.data.id || "";

    // (По избор) запис в Google Sheets
    let sheetsOk = true;
    let sheetsErr: string | undefined;
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
        range: `${sheetName}!A1`,
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
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
