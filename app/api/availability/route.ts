// app/api/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { dayBounds, generateSlots, fmtHHmmLocal } from "@/app/lib/datetime";

export const runtime = "nodejs";          // важнo за Vercel (НЕ Edge)
export const dynamic = "force-dynamic";   // без кеш

type Slot = { time: string; available: boolean };

type DayEvent = {
  id: string;
  summary: string;
  start: string; // ISO
  end: string;   // ISO
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || "";
    const duration = Number(searchParams.get("duration") || "30"); // 30 | 60

    if (!date || (duration !== 30 && duration !== 60)) {
      return NextResponse.json({ slots: [], events: [] });
    }

    const calId = process.env.BOOKING_CALENDAR_ID;
    if (!calId) {
      console.error("BOOKING_CALENDAR_ID is missing.");
      return NextResponse.json({ slots: [], events: [] }, { status: 500 });
    }

    const cal = getCalendar();

    // Работно време – при нужда смени
    const WORK_START = "09:00";
    const WORK_END   = "18:30";

    // Граници на деня (локално София → UTC ISO)
    const { timeMin, timeMax } = dayBounds(date);

    // 1) FREEBUSY – основният източник за заетост
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: "Europe/Sofia",
        items: [{ id: calId }],
      },
    });

    const busyFB =
      (fb.data.calendars?.[calId]?.busy as Array<{ start?: string | null; end?: string | null }> | undefined) || [];

    // 2) EVENTS.LIST – допълваме за всеки случай (покрива all-day и др.)
    const evRes = await cal.events.list({
      calendarId: calId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      timeZone: "Europe/Sofia",
      showDeleted: false,
      maxResults: 2500,
    });

    const rawEvents = evRes.data.items || [];

    // превръщаме events в busy, ако transparency != 'transparent' и не са cancelled
    const busyFromEvents = rawEvents
      .filter(e =>
        e.status !== "cancelled" &&
        (e.transparency ?? "opaque") !== "transparent" &&
        e.start && e.end
      )
      .map(e => ({
        start: (e.start!.dateTime || e.start!.date)!,
        end:   (e.end!.dateTime   || e.end!.date)!,
      }));

    // Обединен списък от busy интервали
    const busyAll = [...busyFB, ...busyFromEvents];

    function isFree(start: Date, end: Date) {
      return !busyAll.some((b) => {
        const bStart = new Date(b.start ?? "");
        const bEnd = new Date(b.end ?? "");
        return start < bEnd && end > bStart;
      });
    }

    // Събития за показване във фронта (read-only)
    const events: DayEvent[] = rawEvents
      .filter(e => e.start && e.end)
      .map(e => ({
        id: e.id || `${(e.start?.dateTime || e.start?.date || "")}-${(e.end?.dateTime || e.end?.date || "")}`,
        summary: e.summary || "(без заглавие)",
        start: (e.start?.dateTime || e.start?.date)!,
        end:   (e.end?.dateTime   || e.end?.date)!,
      }));

    // Генерираме слотовете (30-мин стъпка)
    const slots: Slot[] = [];
    for (const t of generateSlots(date, WORK_START, WORK_END, 30)) {
      const start = t;
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const label = fmtHHmmLocal(start);

      if (duration === 30) {
        slots.push({ time: label, available: isFree(start, end) });
      } else {
        // 60 мин → и следващият 30-мин сегмент да е свободен
        const end60 = new Date(start.getTime() + 60 * 60 * 1000);
        const ok = isFree(start, end) && isFree(end, end60);
        slots.push({ time: label, available: ok });
      }
    }

    return NextResponse.json({ slots, events });
  } catch (e) {
    console.error("AVAILABILITY ERROR:", e);
    return NextResponse.json({ slots: [], events: [] }, { status: 500 });
  }
}
