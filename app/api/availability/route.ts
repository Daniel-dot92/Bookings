import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import {
  dayBounds,
  generateSlots,
  fmtHHmmLocal,
  parseZoned,
} from "@/app/lib/datetime";
import { WORKING_HOURS } from "@/app/lib/hours";
import { addMinutes } from "date-fns";

/**
 * GET /api/availability?date=YYYY-MM-DD&duration=30|60
 */
export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date"); // YYYY-MM-DD
    const duration = Number(
      req.nextUrl.searchParams.get("duration") || "30",
    ); // 30|60

    if (!date || (duration !== 30 && duration !== 60)) {
      return NextResponse.json(
        { slots: [], error: "invalid params" },
        { status: 400 },
      );
    }

    // Работно време според деня от седмицата
    const dow = new Date(date).getDay();
    const hours = WORKING_HOURS[dow];
    if (!hours) return NextResponse.json({ slots: [] }); // почивен ден

    // Google Calendar Free/Busy
    const cal = getCalendar();
    const { timeMin, timeMax } = dayBounds(date);

    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: "Europe/Sofia",
        items: [{ id: process.env.BOOKING_CALENDAR_ID! }],
      },
    });

    // Списък от заетите интервали [start, end)
    const busy =
      (fb.data.calendars?.[process.env.BOOKING_CALENDAR_ID!]?.busy as
        | Array<{ start?: string | null; end?: string | null }>
        | undefined) || [];

    // Кандидат-слотове през 30 минути
    const candidates = Array.from(
      generateSlots(date, hours.start, hours.end, 30),
    );

    // Край на работния ден (UTC) – за да не предлагаме 18:30 → 19:30, ако краят е 19:00
    const workEndUtc = parseZoned(date, hours.end);

    // Проверка за застъпване с „busy“
    function overlapsAny(startUtc: Date, endUtc: Date) {
      return busy.some((b) => {
        const bStart = new Date(b.start ?? "");
        const bEnd = new Date(b.end ?? "");
        return startUtc < bEnd && endUtc > bStart;
      });
    }

    // Финални слотове за избраната продължителност
    const slots = candidates.map((startUtc) => {
      const endUtc = addMinutes(startUtc, duration);
      const fitsInWorkingHours = endUtc <= workEndUtc;
      const free = fitsInWorkingHours && !overlapsAny(startUtc, endUtc);
      return { time: fmtHHmmLocal(startUtc), available: free };
    });

    return NextResponse.json({ slots });
  } catch (e: unknown) {
    console.error("availability error:", e);
    const message = e instanceof Error ? e.message : "server error";
    return NextResponse.json(
      { slots: [], error: message },
      { status: 500 },
    );
  }
}
