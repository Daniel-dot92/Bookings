import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { dayBounds, fmtHHmmLocal, generateSlots, parseZoned } from "@/app/lib/datetime";
import {
  type ShiftWindow,
  getOfficeTherapists,
  getTherapistShift,
  isOfficeKey,
  isTherapistSelectionKey,
} from "@/app/lib/booking-config";
import { getCalendarIdForOffice } from "@/app/lib/booking-config.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Slot = { time: string; available: boolean };

const MIN_LEAD_TIME_MINUTES = 120;

function isGoogleCalendarNotFound(error: unknown) {
  const status =
    typeof error === "object" && error !== null
      ? (error as { code?: number; response?: { status?: number } }).response?.status ??
        (error as { code?: number }).code
      : undefined;
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  return status === 404 || message === "Not Found";
}

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

function buildSlotsForWindow(args: {
  date: string;
  duration: number;
  window: ShiftWindow;
  isRequestedDateToday: boolean;
  isRequestedDateTomorrow: boolean;
  isAfterTenPmInSofia: boolean;
  minLeadTime: Date;
  isFree: (start: Date, end: Date) => boolean;
}) {
  const result: Slot[] = [];
  const winStart = parseZoned(args.date, args.window.start);
  const winEnd = parseZoned(args.date, args.window.end);

  for (const start of generateSlots(args.date, args.window.start, args.window.end, 60)) {
    if (args.isRequestedDateToday && start < args.minLeadTime) continue;

    const label = fmtHHmmLocal(start);
    if (args.isRequestedDateTomorrow && args.isAfterTenPmInSofia && label === "08:00") {
      continue;
    }

    const end =
      args.duration === 30
        ? new Date(start.getTime() + 30 * 60 * 1000)
        : args.duration === 60
        ? new Date(start.getTime() + 60 * 60 * 1000)
        : new Date(start.getTime() + 90 * 60 * 1000);

    if (start < winStart || end > winEnd) continue;

    result.push({
      time: label,
      available: args.isFree(start, end),
    });
  }

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || "";
    const duration = Number(searchParams.get("duration") || "30");
    const location = searchParams.get("location");
    const therapist = searchParams.get("therapist");

    if (!date || ![30, 60, 90].includes(duration) || !isOfficeKey(location)) {
      return NextResponse.json({ slots: [] });
    }

    const officeKey = location;
    const therapistSelection = isTherapistSelectionKey(therapist) ? therapist : "any";

    const dNoon = parseZoned(date, "12:00");
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "Europe/Sofia",
    }).format(dNoon);

    if (weekday === "Sun") {
      return NextResponse.json({ slots: [] });
    }

    const isSaturday = weekday === "Sat";
    const officeTherapists = getOfficeTherapists(officeKey);
    if (
      therapistSelection !== "any" &&
      !officeTherapists.includes(therapistSelection)
    ) {
      return NextResponse.json({ slots: [] });
    }

    const shiftWindows =
      therapistSelection === "any"
        ? officeTherapists
            .map((key) => getTherapistShift(officeKey, key, isSaturday))
            .filter(Boolean) as ShiftWindow[]
        : [getTherapistShift(officeKey, therapistSelection, isSaturday)].filter(Boolean) as ShiftWindow[];

    if (shiftWindows.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    const calendarId = getCalendarIdForOffice(officeKey);
    if (!calendarId) {
      console.error(`Missing calendar for office ${officeKey}.`);
      return NextResponse.json({ slots: [] }, { status: 500 });
    }

    const cal = getCalendar();
    try {
      await cal.calendars.get({ calendarId });
    } catch (error) {
      if (isGoogleCalendarNotFound(error)) {
        return NextResponse.json(
          {
            slots: [],
            error: "Онлайн записването за този обект е временно недостъпно. Моля, опитайте отново малко по-късно.",
          },
          { status: 503 }
        );
      }
      throw error;
    }

    const now = new Date();
    const minLeadTime = new Date(now.getTime() + MIN_LEAD_TIME_MINUTES * 60 * 1000);
    const todayInSofia = ymdInSofia(now);
    const tomorrowInSofia = addDaysToYmd(todayInSofia, 1);
    const isRequestedDateToday = date === todayInSofia;
    const isRequestedDateTomorrow = date === tomorrowInSofia;
    const isAfterTenPmInSofia = hmInSofia(now) >= 22 * 60;

    const { timeMin, timeMax } = dayBounds(date);
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: "Europe/Sofia",
        items: [{ id: calendarId }],
      },
    });

    const busy =
      (fb.data.calendars?.[calendarId]?.busy as Array<
        { start?: string | null; end?: string | null }
      > | undefined) || [];

    const isFree = (start: Date, end: Date) =>
      !busy.some((entry) => {
        const busyStart = new Date(entry.start ?? "");
        const busyEnd = new Date(entry.end ?? "");
        return start < busyEnd && end > busyStart;
      });

    const map = new Map<string, Slot>();

    for (const shiftWindow of shiftWindows) {
      const builtSlots = buildSlotsForWindow({
        date,
        duration,
        window: shiftWindow,
        isRequestedDateToday,
        isRequestedDateTomorrow,
        isAfterTenPmInSofia,
        minLeadTime,
        isFree,
      });

      for (const slot of builtSlots) {
        const existing = map.get(slot.time);
        map.set(slot.time, {
          time: slot.time,
          available: (existing?.available ?? false) || slot.available,
        });
      }
    }

    const slots = [...map.values()].sort((a, b) => a.time.localeCompare(b.time));
    return NextResponse.json({ slots });
  } catch (e) {
    console.error("AVAILABILITY ERROR:", e);
    return NextResponse.json(
      {
        slots: [],
        error: "Свободните часове временно не могат да се заредят.",
      },
      { status: 500 }
    );
  }
}
