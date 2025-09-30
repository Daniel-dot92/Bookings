import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { dayBounds, generateSlots, fmtHHmmLocal, parseZoned } from "@/app/lib/datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Slot = { time: string; available: boolean };

export async function GET(req: NextRequest) {
  try { 
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || "";
    const duration = Number(searchParams.get("duration") || "30"); // 30 | 60 | 90

    if (!date || ![30, 60, 90].includes(duration)) {
      return NextResponse.json({ slots: [] });
    }

    // ❌ Неделя: никакви слотове
    {
      const dNoon = parseZoned(date, "12:00");
      const wd = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: "Europe/Sofia",
      }).format(dNoon);
      if (wd === "Sun") return NextResponse.json({ slots: [] });
    }

    const calId = process.env.BOOKING_CALENDAR_ID;
    if (!calId) {
      console.error("BOOKING_CALENDAR_ID is missing.");
      return NextResponse.json({ slots: [] }, { status: 500 });
    }

    const cal = getCalendar();

    // Работно време (локално време за София)
    const WORK_START = "09:00";
    const WORK_END   = "18:30";

    // busy интервали за деня
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

    // Еднократна проверка за припокриване на интервали
    function isFree(start: Date, end: Date) {
      return !busy.some((b) => {
        const bStart = new Date(b.start ?? "");
        const bEnd = new Date(b.end ?? "");
        return start < bEnd && end > bStart;
      });
    }

    // Граници в локално време (за да режем излизащи след края)
    const workStart = parseZoned(date, WORK_START);
    const workEnd   = parseZoned(date, WORK_END);

    const slots: Slot[] = [];

    // Базови стартове през 30 минути
    for (const start of generateSlots(date, WORK_START, WORK_END, 30)) {
      const label = fmtHHmmLocal(start);

      // Краен момент според желаната продължителност
      const end =
        duration === 30
          ? new Date(start.getTime() + 30 * 60 * 1000)
          : duration === 60
          ? new Date(start.getTime() + 60 * 60 * 1000)
          : new Date(start.getTime() + 90 * 60 * 1000);

      // ⛔️ Прескачаме слотове, които излизат извън работното време
      if (start < workStart || end > workEnd) {
        continue;
      }

      // ✅ Една проверка за заетост на целия интервал
      const ok = isFree(start, end);

      slots.push({ time: label, available: ok });
    }

    return NextResponse.json({ slots });
  } catch (e) {
    console.error("AVAILABILITY ERROR:", e);
    return NextResponse.json({ slots: [] }, { status: 500 });
  }
}
