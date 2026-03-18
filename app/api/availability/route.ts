import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { dayBounds, generateSlots, fmtHHmmLocal, parseZoned } from "@/app/lib/datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Slot = { time: string; available: boolean };
type TherapistKey = "any" | "daniel" | "elitsa";
const MIN_LEAD_TIME_MINUTES = 120;

function ymdInSofia(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function hmInSofia(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function addDaysToYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Делнични (Mon–Fri)
const WEEKDAY_SHIFT = {
  daniel: { START: "13:00", END: "19:00" },
  elitsa: { START: "08:00", END: "13:00" },
} as const;

// Събота
const SAT_SHIFT = {
  daniel: { START: "13:00", END: "16:00" },
  elitsa: { START: "08:00", END: "13:00" },
} as const;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || "";
    const duration = Number(searchParams.get("duration") || "30"); // 30 | 60 | 90
    const therapist = (searchParams.get("therapist") || "any") as TherapistKey;

    if (!date || ![30, 60, 90].includes(duration)) {
      return NextResponse.json({ slots: [] });
    }

    // Ден от седмицата по Europe/Sofia
    const dNoon = parseZoned(date, "12:00");
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "Europe/Sofia",
    }).format(dNoon);

    // ❌ Неделя: почивен ден
    if (weekday === "Sun") {
      return NextResponse.json({ slots: [] });
    }

    const calId = process.env.BOOKING_CALENDAR_ID;
    if (!calId) {
      console.error("BOOKING_CALENDAR_ID is missing.");
      return NextResponse.json({ slots: [] }, { status: 500 });
    }

    const cal = getCalendar();
    const now = new Date();
    const minLeadTime = new Date(
      now.getTime() + MIN_LEAD_TIME_MINUTES * 60 * 1000
    );
    const nowMinutesInSofia = hmInSofia(now);
    const isAfterTenPmInSofia = nowMinutesInSofia >= 22 * 60;
    const todayInSofia = ymdInSofia(now);
    const tomorrowInSofia = addDaysToYmd(todayInSofia, 1);
    const isRequestedDateToday = date === todayInSofia;
    const isRequestedDateTomorrow = date === tomorrowInSofia;

    // Вземаме заетост за целия ден
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

    const isFree = (start: Date, end: Date) =>
      !busy.some((b) => {
        const bStart = new Date(b.start ?? "");
        const bEnd = new Date(b.end ?? "");
        return start < bEnd && end > bStart;
      });

    // Генерира слотове за зададен прозорец
    function buildSlotsForWindow(startHHmm: string, endHHmm: string): Slot[] {
      const result: Slot[] = [];
      const winStart = parseZoned(date, startHHmm);
      const winEnd = parseZoned(date, endHHmm);

      for (const start of generateSlots(date, startHHmm, endHHmm, 30)) {
        // За днешния ден показваме само часове поне 2 часа напред.
        if (isRequestedDateToday && start < minLeadTime) continue;

        const label = fmtHHmmLocal(start);
        // След 22:00 не показваме слотове 08:00 и 08:30 за следващия ден.
        if (
          isRequestedDateTomorrow &&
          isAfterTenPmInSofia &&
          (label === "08:00" || label === "08:30")
        ) {
          continue;
        }

        const end =
          duration === 30
            ? new Date(start.getTime() + 30 * 60 * 1000)
            : duration === 60
            ? new Date(start.getTime() + 60 * 60 * 1000)
            : new Date(start.getTime() + 90 * 60 * 1000);

        // слотът трябва да е изцяло в рамките на работния прозорец
        if (start < winStart || end > winEnd) continue;

        result.push({ time: label, available: isFree(start, end) });
      }
      return result;
    }

    // Избор на прозорци според деня
    const isSaturday = weekday === "Sat";
    const SHIFT = isSaturday ? SAT_SHIFT : WEEKDAY_SHIFT;

    let slots: Slot[] = [];

    if (therapist === "daniel") {
      slots = buildSlotsForWindow(SHIFT.daniel.START, SHIFT.daniel.END);
    } else if (therapist === "elitsa") {
      slots = buildSlotsForWindow(SHIFT.elitsa.START, SHIFT.elitsa.END);
    } else {
      // "any" → обединяваме прозорците на двамата
      const a = buildSlotsForWindow(SHIFT.elitsa.START, SHIFT.elitsa.END);
      const b = buildSlotsForWindow(SHIFT.daniel.START, SHIFT.daniel.END);
      const map = new Map<string, Slot>();
      [...a, ...b].forEach((s) => {
        const prev = map.get(s.time);
        map.set(s.time, { time: s.time, available: (prev?.available ?? false) || s.available });
      });
      slots = Array.from(map.values()).sort((x, y) => x.time.localeCompare(y.time));
    }

    return NextResponse.json({ slots });
  } catch (e) {
    console.error("AVAILABILITY ERROR:", e);
    return NextResponse.json({ slots: [] }, { status: 500 });
  }
}
