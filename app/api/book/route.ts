// app/api/book/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { parseZoned } from "@/app/lib/datetime";

export const runtime = "nodejs";          // важнo за Vercel (НЕ Edge)
export const dynamic = "force-dynamic";   // без кеширане

type Payload = {
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
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
    // Проверка на env в продъкшън
    const calId = process.env.BOOKING_CALENDAR_ID;
    const useSA = String(process.env.USE_SERVICE_ACCOUNT).toLowerCase() === "true";
    if (!calId) {
      console.error("BOOKING_CALENDAR_ID is missing.");
      return NextResponse.json(
        { error: "Липсва BOOKING_CALENDAR_ID на сървъра." },
        { status: 500 }
      );
    }
    if (useSA && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
      console.error("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is missing.");
      return NextResponse.json(
        { error: "Липсва GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 на сървъра." },
        { status: 500 }
      );
    }

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
      return NextResponse.json({ error: "Липсват задължителни полета." }, { status: 400 });
    }

    const dur = Number(duration);
    if (dur !== 30 && dur !== 60) {
      return NextResponse.json({ error: "Невалидна продължителност (30|60)." }, { status: 400 });
    }

    // Времеви интервал (Europe/Sofia → UTC)
    const startUtc = parseZoned(date, time);
    const endUtc = new Date(startUtc.getTime() + dur * 60 * 1000);

    const cal = getCalendar();

    // Free/busy преди запис
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
        { error: "Току-що се зае този интервал. Моля, изберете друг час." },
        { status: 409 }
      );
    }

    // Event summary/description
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

    // JSON отговор (front-ът очаква JSON)
    return NextResponse.json({ ok: true, eventId: resIns.data.id });
  } catch (e) {
    console.error("BOOK ERROR:", e);
    const message = e instanceof Error ? e.message : "Грешка при записването.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
