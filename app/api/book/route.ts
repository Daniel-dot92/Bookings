import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { parseZoned } from "@/app/lib/datetime";

type Payload = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  duration: string | number; // "30" | "60"
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  procedure: string;
  symptoms?: string;
};

async function readBody(req: NextRequest): Promise<Payload> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return (await req.json()) as Payload;
  }
  // Поддръжка на form POST (application/x-www-form-urlencoded или multipart/form-data)
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

/**
 * POST /api/book
 * Създава събитие в Google Calendar след допълнителна free/busy проверка.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    const {
      date,
      time,
      duration,
      firstName,
      lastName,
      email,
      phone,
      procedure,
      symptoms,
    } = body;

    // Валидация
    if (
      !date ||
      !time ||
      !duration ||
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !procedure
    ) {
      return NextResponse.json(
        { error: "Липсват задължителни полета." },
        { status: 400 },
      );
    }

    const dur = Number(duration);
    if (dur !== 30 && dur !== 60) {
      return NextResponse.json(
        { error: "Невалидна продължителност (30|60)." },
        { status: 400 },
      );
    }

    // Времеви интервал в UTC
    const startUtc = parseZoned(date, time);
    const endUtc = new Date(startUtc.getTime() + dur * 60 * 1000);

    // Допълнителна free/busy проверка точно преди записа
    const cal = getCalendar();
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: startUtc.toISOString(),
        timeMax: endUtc.toISOString(),
        timeZone: "Europe/Sofia",
        items: [{ id: process.env.BOOKING_CALENDAR_ID! }],
      },
    });

    const busy =
      (fb.data.calendars?.[process.env.BOOKING_CALENDAR_ID!]?.busy as
        | Array<{ start?: string | null; end?: string | null }>
        | undefined) || [];

    const overlaps = busy.some((b) => {
      const bStart = new Date(b.start ?? "");
      const bEnd = new Date(b.end ?? "");
      return startUtc < bEnd && endUtc > bStart;
    });

    if (overlaps) {
      return NextResponse.json(
        { error: "Току-що се зае този интервал. Моля, изберете друг час." },
        { status: 409 },
      );
    }

    // Създаване на събитие
    const summary = `Резервация: ${firstName} ${lastName} – ${procedure} (${dur} мин)`;
    const description = `Име: ${firstName} ${lastName}
Имейл: ${email}
Телефон: ${phone}
Процедура: ${procedure}
Симптоми: ${symptoms || "—"}
Източник: Уебсайт`;

   const res = await cal.events.insert({
  calendarId: process.env.BOOKING_CALENDAR_ID!,
  requestBody: {
    summary,
    description,
    start: { dateTime: startUtc.toISOString(), timeZone: "Europe/Sofia" },
    end:   { dateTime: endUtc.toISOString(),   timeZone: "Europe/Sofia" },

    // НЯМА attendees при service account
    guestsCanInviteOthers: false,
    guestsCanModify: false,
    guestsCanSeeOtherGuests: false,
  },
  //sendUpdates: 'all', // махаме го – няма смисъл без attendees
});

    // Ако заявката е от HTML форма – върни проста страница „Успех“
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const html = `
        <html><body style="font-family:Arial;padding:24px">
          <h2>Успешно записване!</h2>
          <p>Ще получите имейл потвърждение.</p>
          <p><a href="/">Назад</a></p>
        </body></html>`;
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Иначе – JSON
    return NextResponse.json({ ok: true, eventId: res.data.id });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Грешка при записването.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
