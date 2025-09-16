// app/api/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { dayBounds, generateSlots, fmtHHmmLocal } from "@/app/lib/datetime";

export const runtime = "nodejs";          // важнo за Vercel (НЕ Edge)
export const dynamic = "force-dynamic";   // без кеш

type Slot = { time: string; available: boolean };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || "";
    const duration = Number(searchParams.get("duration") || "30"); // 30 | 60

    if (!date || (duration !== 30 && duration !== 60)) {
      return NextResponse.json({ slots: [] });
    }

    const calId = process.env.BOOKING_CALENDAR_ID;
    if (!calId) {
      console.error("BOOKING_CALENDAR_ID is missing.");
      return NextResponse.json({ slots: [] }, { status: 500 });
    }

    const cal = getCalendar();

    // Работно време – при нужда смени
    const WORK_START = "09:00";
    const WORK_END   = "18:30";

    // Изтегляме busy за деня
    const { timeMin, timeMax } = dayBounds(date);
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: "Europe/Sofia",
        items: [{ id: calId }],
      },
    });

    const busy =
      (fb.data.calendars?.[calId]?.busy as Array<{ start?: string | null; end?: string | null }> | undefined) || [];

    // Правим прост helper, който казва дали даден интервал [s, e) се засича с busy интервал
    function isFree(start: Date, end: Date) {
      return !busy.some((b) => {
        const bStart = new Date(b.start ?? "");
        const bEnd = new Date(b.end ?? "");
        return start < bEnd && end > bStart;
      });
    }

    const slots: Slot[] = [];

    // генерираме на 30 минути
    for (const t of generateSlots(date, WORK_START, WORK_END, 30)) {
      const start = t;
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const label = fmtHHmmLocal(start);

      if (duration === 30) {
        slots.push({ time: label, available: isFree(start, end) });
      } else {
        // за 60 мин – трябва и следващият 30-мин сегмент да е свободен
        const end60 = new Date(start.getTime() + 60 * 60 * 1000);
        const ok = isFree(start, end) && isFree(end, end60);
        slots.push({ time: label, available: ok });
      }
    }

    return NextResponse.json({ slots });
  } catch (e) {
    console.error("AVAILABILITY ERROR:", e);
    return NextResponse.json({ slots: [] }, { status: 500 });
  }
}
