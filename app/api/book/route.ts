// /app/api/book/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCalendar, getSheets } from "@/app/lib/google";
import { parseZoned } from "@/app/lib/datetime";
import { sendBookingEmailSMTP } from "@/app/lib/email";
import { calendar_v3 } from "googleapis";

// Runtime настройки
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Типове
type TherapistKey = "any" | "daniel" | "elitsa";
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
  therapist?: TherapistKey;
};

// Работно време
const SHIFT = {
  daniel: { START: "13:00", END: "19:00" },
  elitsa: { START: "09:00", END: "13:00" },
};

// 📥 Четене на заявка
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
    therapist: (get("therapist") as TherapistKey) || "any",
  };
}

// 🕓 Форматиране на дати
function toLocalISO(d: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const tzDate = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`
  );
  const offsetMs = tzDate.getTime() - d.getTime();
  const sign = offsetMs >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMs);
  const offH = String(Math.floor(abs / 3_600_000)).padStart(2, "0");
  const offM = String(Math.floor((abs % 3_600_000) / 60_000)).padStart(2, "0");

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${offH}:${offM}`;
}

function formatBGDate(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("bg-BG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(d);
}

function formatHHMM(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("bg-BG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
}

// 🚀 Главна функция
export async function POST(req: NextRequest) {
  try {
    console.log("[BOOK] stage: init");

    const calId = process.env.BOOKING_CALENDAR_ID;
    const useSA = String(process.env.USE_SERVICE_ACCOUNT).toLowerCase() === "true";

    if (!calId)
      return NextResponse.json({ ok: false, error: "Липсва BOOKING_CALENDAR_ID." }, { status: 500 });

    if (useSA && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64)
      return NextResponse.json({ ok: false, error: "Липсва GOOGLE_SERVICE_ACCOUNT_JSON_BASE64." }, { status: 500 });

    console.log("[BOOK] stage: read-body");
    const body = await readBody(req);

    const {
      date, time, duration,
      firstName, lastName, email, phone,
      procedure, symptoms,
      therapist = "any",
    } = body;

    // 🧩 Валидация
    if (!date || !time || !duration || !firstName || !lastName || !email || !phone || !procedure)
      return NextResponse.json({ ok: false, error: "Липсват задължителни полета." }, { status: 400 });

    const dur = Number(duration);
    if (![30, 60, 90].includes(dur))
      return NextResponse.json({ ok: false, error: "Невалидна продължителност (30|60|90)." }, { status: 400 });

    const dNoon = parseZoned(date, "12:00");
    const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Sofia" }).format(dNoon);
    if (wd === "Sun")
      return NextResponse.json({ ok: false, error: "Неделя е почивен ден. Моля, изберете друга дата." }, { status: 400 });

    const within = (t: string, s: string, e: string) => t >= s && t <= e;
    if (therapist === "daniel" && !within(time, SHIFT.daniel.START, SHIFT.daniel.END))
      return NextResponse.json({ ok: false, error: "Часът е извън работното време на Даниел (13:00–19:00)." }, { status: 400 });

    if (therapist === "elitsa" && !within(time, SHIFT.elitsa.START, SHIFT.elitsa.END))
      return NextResponse.json({ ok: false, error: "Часът е извън работното време на Елица (09:00–13:00)." }, { status: 400 });

    // 🕒 Дати и формати
    const tzid = "Europe/Sofia";
    const startUtc = parseZoned(date, time);
    const endUtc = new Date(startUtc.getTime() + dur * 60 * 1000);

    // Не допускаме запис в минал или вече започнал час.
    if (startUtc <= new Date()) {
      return NextResponse.json(
        { ok: false, error: "Този час вече е минал. Моля, изберете бъдещ час." },
        { status: 400 }
      );
    }

    const startISO = toLocalISO(startUtc, tzid);
    const endISO = toLocalISO(endUtc, tzid);
    const dateText = formatBGDate(startUtc, tzid);
    const timeText = `${formatHHMM(startUtc, tzid)}–${formatHHMM(endUtc, tzid)} (${dur} мин)`;

    // 🗓️ Проверка за заетост
    const cal = getCalendar();
    console.log("[BOOK] stage: freebusy-check]");
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: startUtc.toISOString(),
        timeMax: endUtc.toISOString(),
        timeZone: tzid,
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

    if (overlaps)
      return NextResponse.json({ ok: false, error: "Този интервал току-що беше зает. Моля, изберете друг час." }, { status: 409 });

    // 👤 Терапевт и описание
    const therapistName =
      therapist === "daniel" ? "Даниел Митев" :
      therapist === "elitsa" ? "Елица Колева" : "Без значение";

    const summary = `Резервация: ${firstName} ${lastName} – ${procedure} (${dur} мин)`;
    const description = `Име: ${firstName} ${lastName}
Имейл: ${email}
Телефон: ${phone}
Процедура: ${procedure}
Симптоми: ${symptoms || "—"}
Терапевт: ${therapistName}
Източник: Уебсайт`;

    const SEND_GCAL_INVITE = String(process.env.SEND_GCAL_INVITE).toLowerCase() === "true";

    const eventRequestBody: calendar_v3.Schema$Event = {
      summary,
      description,
      start: { dateTime: startUtc.toISOString(), timeZone: tzid },
      end: { dateTime: endUtc.toISOString(), timeZone: tzid },
      location: "София, ул. Професор Христо Данов 19",
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
    };
    if (SEND_GCAL_INVITE) eventRequestBody.attendees = [{ email }];

    // ===== ДОБАВКА: метаданни за имейл за ревю (край + 30 мин) =====
    const reviewDueAtISO = new Date(endUtc.getTime() + 30 * 60 * 1000).toISOString();
    eventRequestBody.extendedProperties = {
      private: {
        reviewDueAt: reviewDueAtISO,
        reviewEmailSent: "0",
        customerEmail: email,
        customerFirstName: firstName,
        customerLastName: lastName || "",
        customerPhone: phone,
      },
    };
    // ===============================================================

    console.log("[BOOK] stage: create-event");
    const created = await cal.events.insert({
      calendarId: calId,
      ...(SEND_GCAL_INVITE ? { sendUpdates: "all" as const } : {}),
      requestBody: eventRequestBody,
    });
    const eventId = created.data.id || "";
    console.log("[BOOK] stage: event-inserted", eventId);

    // 🧾 Добавяне в Google Sheets
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
        timeZone: tzid,
      }).format(new Date());

      console.log("[BOOK] stage: sheets-append");
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[
            timestamp, date, time, dur,
            firstName, lastName, email, phone,
            procedure, symptoms || "", eventId,
            therapistName, "website",
          ]],
        },
      });
      console.log("[BOOK] stage: sheets-done");
    } catch (err: unknown) {
      sheetsOk = false;
      sheetsErr = err instanceof Error ? err.message : String(err);
      console.error("[BOOK] Sheets append failed:", sheetsErr);
    }

    // 📧 Изпращане на имейл потвърждение
    let emailOk = true;
    let emailErr: string | undefined;
    try {
      console.log("[BOOK] stage: send-email");

      const address = "София, ул. Професор Христо Данов 19";
      const mapsUrl = "https://maps.app.goo.gl/vFHqq2TFV7XRVSTd8";

      await sendBookingEmailSMTP({
        to: email,
        from: process.env.EMAIL_FROM || "DM PHYSIO <dmphysio369@gmail.com>",
        subject: "Потвърждение за запазен час – DM PHYSIO",
        firstName,
        lastName,
        dateText,
        timeText,
        therapist: therapist !== "any" ? therapistName : undefined,
        procedure,
        phone,
        address,
        notes: symptoms,
        eventUid: eventId || undefined,
        startISO,
        endISO,
        tzid,
        extraHtml: `
          <p style="margin-top:16px;">
            <a href="${mapsUrl}" target="_blank"
               style="display:inline-block;margin-top:8px;padding:10px 16px;
                      background:#00c4c4;color:#fff;font-weight:bold;
                      border-radius:8px;text-decoration:none;">
              Навигация с Google Maps
            </a>
          </p>
        `,
      });

      console.log("[BOOK] stage: email-sent");
    } catch (e: unknown) {
      emailOk = false;
      emailErr = e instanceof Error ? e.message : String(e);
      console.error("[BOOK] Email send failed:", emailErr);
    }

    // ✅ Финален отговор
    return NextResponse.json({ ok: true, eventId, sheetsOk, sheetsErr, emailOk, emailErr });
  } catch (e) {
    console.error("[BOOK] ERROR:", e);
    const message = e instanceof Error ? e.message : "Грешка при записването.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
