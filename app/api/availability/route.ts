// app/api/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { dayBounds, generateSlots, fmtHHmmLocal, parseZoned } from "@/app/lib/datetime";
import { WORKING_HOURS } from "@/app/lib/hours";
import { addMinutes, addDays, startOfDay } from "date-fns";

function todayYMDInTZ(tz: string) {
  // ISO-like yyyy-mm-dd в конкретна часова зона
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // напр. 2025-09-17
}

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date"); // YYYY-MM-DD
    const duration = Number(req.nextUrl.searchParams.get("duration") || "30"); // 30|60

    if (!date || (duration !== 30 && duration !== 60)) {
      return NextResponse.json({ slots: [], error: "invalid params" }, { status: 400 });
    }

    // Ограничения: от утре до +21 дни (в Europe/Sofia)
    const tz = "Europe/Sofia";
    const todayStr = todayYMDInTZ(tz);
    const todayStart = parseZoned(todayStr, "00:00");
    const minStart = addMinutes(todayStart, 24 * 60); // утре 00:00
    const maxStart = addMinutes(minStart, 21 * 24 * 60); // +21 дни

    const reqStart = parseZoned(date, "00:00");
    if (reqStart < minStart || reqStart > maxStart) {
      return NextResponse.json({ slots: [] }); // извън диапазона – няма слотове
    }

    const dow = new Date(date).getDay();
    const hours = WORKING_HOURS[dow];
    if (!hours) return NextResponse.json({ slots: [] }); // почивен

    const cal = getCalendar();
    const { timeMin, timeMax } = dayBounds(date);

    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: tz,
        items: [{ id: process.env.BOOKING_CALENDAR_ID! }],
      },
    });

    const busy = fb.data.calendars?.[process.env.BOOKING_CALENDAR_ID!]?.busy || [];

    const candidates = Array.from(generateSlots(date, hours.start, hours.end, 30));
    const workEndUtc = parseZoned(date, hours.end);

    function overlapsAny(startUtc: Date, endUtc: Date) {
      return busy.some((b) => {
        const bStart = new Date(b.start!);
        const bEnd = new Date(b.end!);
        return startUtc < bEnd && endUtc > bStart;
      });
    }

    const slots = candidates.map((startUtc) => {
      const endUtc = addMinutes(startUtc, duration);
      const fitsInWorkingHours = endUtc <= workEndUtc;
      const free = fitsInWorkingHours && !overlapsAny(startUtc, endUtc);
      return { time: fmtHHmmLocal(startUtc), available: free };
    });

    return NextResponse.json({ slots });
  } catch (e: any) {
    console.error("availability error:", e);
    return NextResponse.json({ slots: [], error: "server error" }, { status: 500 });
  }
}
