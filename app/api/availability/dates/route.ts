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

const MIN_LEAD_TIME_MINUTES = 120;
const MAX_DAYS = 28;

type BusyWindow = {
  start?: string | null;
  end?: string | null;
};

function ymdInSofia(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hmInSofia(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function addDaysToYmd(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function weekdayForDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Europe/Sofia",
  }).format(parseZoned(date, "12:00"));
}

function hasAvailableSlot(args: {
  date: string;
  duration: number;
  shiftWindows: ShiftWindow[];
  busy: BusyWindow[];
  now: Date;
  today: string;
  tomorrow: string;
  afterTenPm: boolean;
}) {
  const minLeadTime = new Date(
    args.now.getTime() + MIN_LEAD_TIME_MINUTES * 60 * 1000
  );

  for (const window of args.shiftWindows) {
    const windowStart = parseZoned(args.date, window.start);
    const windowEnd = parseZoned(args.date, window.end);

    for (const start of generateSlots(args.date, window.start, window.end, 60)) {
      if (args.date === args.today && start < minLeadTime) continue;

      const label = fmtHHmmLocal(start);
      if (
        args.date === args.tomorrow &&
        args.afterTenPm &&
        label === "08:00"
      ) {
        continue;
      }

      const end = new Date(start.getTime() + args.duration * 60 * 1000);
      if (start < windowStart || end > windowEnd) continue;

      const isBusy = args.busy.some((entry) => {
        const busyStart = new Date(entry.start ?? "");
        const busyEnd = new Date(entry.end ?? "");
        return start < busyEnd && end > busyStart;
      });

      if (!isBusy) return true;
    }
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start") || "";
    const requestedDays = Number(searchParams.get("days") || MAX_DAYS);
    const duration = Number(searchParams.get("duration") || "60");
    const location = searchParams.get("location");
    const therapist = searchParams.get("therapist");

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !Number.isInteger(requestedDays) ||
      requestedDays < 1 ||
      requestedDays > MAX_DAYS ||
      ![30, 60, 90].includes(duration) ||
      !isOfficeKey(location)
    ) {
      return NextResponse.json({ unavailableDates: [] }, { status: 400 });
    }

    const therapistSelection = isTherapistSelectionKey(therapist)
      ? therapist
      : "any";
    const officeTherapists = getOfficeTherapists(location);

    if (
      therapistSelection !== "any" &&
      !officeTherapists.includes(therapistSelection)
    ) {
      return NextResponse.json({ unavailableDates: [] }, { status: 400 });
    }

    const calendarId = getCalendarIdForOffice(location);
    if (!calendarId) {
      return NextResponse.json({ unavailableDates: [] }, { status: 500 });
    }

    const endDate = addDaysToYmd(start, requestedDays - 1);
    const { timeMin } = dayBounds(start);
    const { timeMax } = dayBounds(endDate);
    const calendar = getCalendar();
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: "Europe/Sofia",
        items: [{ id: calendarId }],
      },
    });
    const busy =
      (freeBusy.data.calendars?.[calendarId]?.busy as BusyWindow[] | undefined) ||
      [];

    const now = new Date();
    const today = ymdInSofia(now);
    const tomorrow = addDaysToYmd(today, 1);
    const afterTenPm = hmInSofia(now) >= 22 * 60;
    const unavailableDates: string[] = [];

    for (let index = 0; index < requestedDays; index += 1) {
      const date = addDaysToYmd(start, index);
      const weekday = weekdayForDate(date);

      if (weekday === "Sun") {
        unavailableDates.push(date);
        continue;
      }

      const isSaturday = weekday === "Sat";
      const shiftWindows =
        therapistSelection === "any"
          ? officeTherapists
              .map((key) => getTherapistShift(location, key, isSaturday))
              .filter(Boolean) as ShiftWindow[]
          : [
              getTherapistShift(
                location,
                therapistSelection,
                isSaturday
              ),
            ].filter(Boolean) as ShiftWindow[];

      if (
        shiftWindows.length === 0 ||
        !hasAvailableSlot({
          date,
          duration,
          shiftWindows,
          busy,
          now,
          today,
          tomorrow,
          afterTenPm,
        })
      ) {
        unavailableDates.push(date);
      }
    }

    return NextResponse.json({ unavailableDates });
  } catch (error) {
    console.error("AVAILABILITY DATES ERROR:", error);
    return NextResponse.json(
      { unavailableDates: [] },
      { status: 500 }
    );
  }
}
