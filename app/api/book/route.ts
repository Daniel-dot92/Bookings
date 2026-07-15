import { NextRequest, NextResponse } from "next/server";
import { calendar_v3 } from "googleapis";
import { getCalendar, getSheets } from "@/app/lib/google";
import { parseZoned } from "@/app/lib/datetime";
import { sendBookingEmailSMTP } from "@/app/lib/email";
import {
  buildManageBookingLink,
  buildReminderScheduledId,
  buildReviewScheduledId,
  getReminderDueAtForAppointment,
  getLocationSmsLinkForOffice,
  getLocationIdForOffice,
  getLocationLabelForOffice,
  getReviewLinkForOffice,
  isValidBookingEmail,
  parseBooleanString,
  readPositiveIntegerEnv,
  shouldSuppressReminderForRecentBooking,
} from "@/app/lib/appointment-communications";
import {
  type OfficeKey,
  type TherapistKey,
  type TherapistSelectionKey,
  getOfficeDefinition,
  getOfficeTherapists,
  getTherapistDefinition,
  getTherapistShift,
  isOfficeKey,
  isTherapistSelectionKey,
} from "@/app/lib/booking-config";
import { getCalendarIdForOffice } from "@/app/lib/booking-config.server";
import {
  BOOKING_SHEET_HEADERS,
  REVIEW_DIRECTORY_HEADERS,
  ensureSheetWithHeaders,
  getManagedOfficeSheetConfigs,
  getSheetConfigForOffice,
} from "@/app/lib/sheets-config.server";
import { normalizePhone } from "@/app/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  location: OfficeKey;
  date: string;
  time: string;
  duration: string | number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  procedure: string;
  symptoms?: string;
  therapist?: TherapistSelectionKey;
  reviewSmsConsent?: boolean | string;
};

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

async function readBody(req: NextRequest): Promise<Payload> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await req.json()) as Payload;

  const fd = await req.formData();
  const get = (k: string) => fd.get(k)?.toString() ?? "";

  return {
    location: (get("location") as OfficeKey) || "studentski-grad",
    date: get("date"),
    time: get("time"),
    duration: get("duration"),
    firstName: get("firstName"),
    lastName: get("lastName"),
    email: get("email"),
    phone: get("phone"),
    procedure: get("procedure"),
    symptoms: get("symptoms") || undefined,
    therapist: (get("therapist") as TherapistSelectionKey) || "any",
    reviewSmsConsent: get("reviewSmsConsent") || "true",
  };
}

function toLocalISO(d: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const tzDate = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`
  );
  const offsetMs = tzDate.getTime() - d.getTime();
  const sign = offsetMs >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMs);
  const offH = String(Math.floor(abs / 3_600_000)).padStart(2, "0");
  const offM = String(Math.floor((abs % 3_600_000) / 60_000)).padStart(2, "0");

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${offH}:${offM}`;
}

function formatBGDate(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("bg-BG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(d);
}

function formatHHMM(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("bg-BG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
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

function toUtcGoogleDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function getPublicBookingOrigin() {
  const candidates = [
    process.env.BOOKING_PUBLIC_ORIGIN,
    process.env.NEXT_PUBLIC_BOOKING_URL,
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    "https://www.dmphysi0.com/book",
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    try {
      return new URL(raw).origin;
    } catch {
      // skip invalid env values
    }
  }
  return "https://www.dmphysi0.com";
}

function getNameCategoryLetter(name: string) {
  const trimmed = name.trim();
  for (const ch of trimmed) {
    if (/\p{L}/u.test(ch)) return ch.toUpperCase();
  }
  return "#";
}

function normalizeEmailValue(value: string) {
  return value.trim().toLowerCase();
}

function coerceBooleanInput(value: string | boolean | undefined, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return parseBooleanString(value, fallback);
  return fallback;
}

async function isReturningPatient(args: {
  sheets: ReturnType<typeof getSheets>;
  phone: string;
  email: string;
}) {
  const normalizedPhone = normalizePhone(args.phone);
  const normalizedEmail = normalizeEmailValue(args.email);
  if (!normalizedPhone && !normalizedEmail) return false;

  for (const sheetConfig of getManagedOfficeSheetConfigs()) {
    if (!sheetConfig.spreadsheetId) continue;

    try {
      const response = await args.sheets.spreadsheets.values.get({
        spreadsheetId: sheetConfig.spreadsheetId,
        range: `${sheetConfig.bookingTabName}!A2:N`,
      });

      for (const row of response.data.values || []) {
        const rowEmail = normalizeEmailValue(String(row[6] || ""));
        const rowPhone = normalizePhone(String(row[7] || ""));
        if (
          (normalizedEmail && rowEmail && normalizedEmail === rowEmail) ||
          (normalizedPhone && rowPhone && normalizedPhone === rowPhone)
        ) {
          return true;
        }
      }
    } catch {
      // ignore missing or inaccessible tabs and continue
    }
  }

  return false;
}

function intervalFitsShift(
  date: string,
  startUtc: Date,
  endUtc: Date,
  shift: { start: string; end: string } | null
) {
  if (!shift) return false;
  const shiftStart = parseZoned(date, shift.start);
  const shiftEnd = parseZoned(date, shift.end);
  return startUtc >= shiftStart && endUtc <= shiftEnd;
}

export async function POST(req: NextRequest) {
  try {
    console.log("[BOOK] stage: init");

    const useSA = String(process.env.USE_SERVICE_ACCOUNT).toLowerCase() === "true";
    if (useSA && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
      return NextResponse.json(
        { ok: false, error: "Липсва GOOGLE_SERVICE_ACCOUNT_JSON_BASE64." },
        { status: 500 }
      );
    }

    console.log("[BOOK] stage: read-body");
    const body = await readBody(req);
    const {
      location,
      date,
      time,
      duration,
      firstName,
      lastName,
      email,
      phone,
      procedure,
      symptoms,
      therapist = "any",
      reviewSmsConsent,
    } = body;

    if (!date || !time || !duration || !firstName || !lastName || !phone || !procedure) {
      return NextResponse.json(
        { ok: false, error: "Липсват задължителни полета." },
        { status: 400 }
      );
    }

    if (!isOfficeKey(location)) {
      return NextResponse.json({ ok: false, error: "Невалиден обект." }, { status: 400 });
    }

    if (!isTherapistSelectionKey(therapist)) {
      return NextResponse.json({ ok: false, error: "Невалиден терапевт." }, { status: 400 });
    }

    const calId = getCalendarIdForOffice(location);
    if (!calId) {
      return NextResponse.json(
        { ok: false, error: "Липсва календар за избрания обект." },
        { status: 500 }
      );
    }

    const dur = Number(duration);
    if (![30, 60, 90].includes(dur)) {
      return NextResponse.json(
        { ok: false, error: "Невалидна продължителност (30|60|90)." },
        { status: 400 }
      );
    }

    const dNoon = parseZoned(date, "12:00");
    const dayName = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "Europe/Sofia",
    }).format(dNoon);
    if (dayName === "Sun") {
      return NextResponse.json(
        { ok: false, error: "Неделя е почивен ден. Моля, изберете друга дата." },
        { status: 400 }
      );
    }

    const now = new Date();
    const todayInSofia = ymdInSofia(now);
    const tomorrowInSofia = addDaysToYmd(todayInSofia, 1);
    const isAfterTenPmInSofia = hmInSofia(now) >= 22 * 60;
    const isBlockedEarlyMorningSlot = time === "08:00" || time === "08:30";
    if (isAfterTenPmInSofia && date === tomorrowInSofia && isBlockedEarlyMorningSlot) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "След 22:00 не може да се записва час за 08:00 или 08:30 на следващия ден. Моля, изберете друг час.",
        },
        { status: 400 }
      );
    }

    const tzid = "Europe/Sofia";
    const startUtc = parseZoned(date, time);
    const endUtc = new Date(startUtc.getTime() + dur * 60 * 1000);
    const isSaturday = dayName === "Sat";

    const availableTherapists = getOfficeTherapists(location);
    if (availableTherapists.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Няма конфигурирани терапевти за този обект." },
        { status: 500 }
      );
    }

    if (therapist !== "any" && !availableTherapists.includes(therapist)) {
      return NextResponse.json(
        { ok: false, error: "Избраният терапевт не работи в този обект." },
        { status: 400 }
      );
    }

    const matchingTherapists = (
      therapist === "any" ? availableTherapists : [therapist]
    ).filter((therapistKey) =>
      intervalFitsShift(
        date,
        startUtc,
        endUtc,
        getTherapistShift(location, therapistKey, isSaturday)
      )
    );

    if (matchingTherapists.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Часът е извън работното време за избрания обект и терапевт." },
        { status: 400 }
      );
    }

    const minLeadTime = new Date(Date.now() + MIN_LEAD_TIME_MINUTES * 60 * 1000);
    if (startUtc < minLeadTime) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "За онлайн запис е нужен минимум 2 часа буфер. Моля, изберете по-късен час.",
        },
        { status: 400 }
      );
    }

    const startISO = toLocalISO(startUtc, tzid);
    const endISO = toLocalISO(endUtc, tzid);
    const dateText = formatBGDate(startUtc, tzid);
    const timeText = `${formatHHMM(startUtc, tzid)}–${formatHHMM(endUtc, tzid)} (${dur} мин)`;

    const cal = getCalendar();
    console.log("[BOOK] stage: freebusy-check");
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: startUtc.toISOString(),
        timeMax: endUtc.toISOString(),
        timeZone: tzid,
        items: [{ id: calId }],
      },
    });

    const busy =
      (fb.data.calendars?.[calId]?.busy as Array<
        { start?: string | null; end?: string | null }
      > | undefined) || [];

    const overlaps = busy.some((b) => {
      const bStart = new Date(b.start ?? "");
      const bEnd = new Date(b.end ?? "");
      return startUtc < bEnd && endUtc > bStart;
    });

    if (overlaps) {
      return NextResponse.json(
        { ok: false, error: "Този интервал току-що беше зает. Моля, изберете друг час." },
        { status: 409 }
      );
    }

    const office = getOfficeDefinition(location);
    const officeName = office.copy.bg.name;
    const address = office.copy.bg.address;
    const mapsUrl = office.mapsUrl;
    const officePhone = office.contactPhone;
    const locationId = getLocationIdForOffice(location);
    const locationLabel = getLocationLabelForOffice(location);
    const locationSmsUrl = getLocationSmsLinkForOffice(location);
    const officeMapsSmsUrl = locationSmsUrl || mapsUrl;
    const bookingOrigin = getPublicBookingOrigin();
    const manageBookingLink = buildManageBookingLink(bookingOrigin, location);
    const reviewLink = getReviewLinkForOffice(location);
    const officeReviewLink = reviewLink || "";
    const hasValidEmail = isValidBookingEmail(email);
    const reviewSmsConsentEnabled = coerceBooleanInput(reviewSmsConsent, true);
    if (!hasValidEmail) {
      return NextResponse.json(
        {
          ok: false,
          error: "Моля, въведете валиден имейл адрес за потвърждението и напомнянето.",
        },
        { status: 400 }
      );
    }
    let sheets: ReturnType<typeof getSheets> | null = null;
    let returningPatient = false;
    try {
      sheets = getSheets();
      returningPatient = await isReturningPatient({
        sheets,
        phone,
        email,
      });
    } catch (error) {
      console.warn("[BOOK] returning-patient lookup skipped:", error);
    }

    try {
      await cal.calendars.get({ calendarId: calId });
    } catch (error) {
      if (isGoogleCalendarNotFound(error)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Онлайн записването за този обект е временно недостъпно. Моля, опитайте отново малко по-късно.",
          },
          { status: 503 }
        );
      }
      throw error;
    }

    const resolvedTherapistKey: TherapistKey | null =
      therapist === "any"
        ? matchingTherapists.length === 1
          ? matchingTherapists[0]
          : null
        : therapist;
    const therapistName =
      resolvedTherapistKey
        ? getTherapistDefinition(resolvedTherapistKey).name.bg
        : "Без значение";

    const summary = `Резервация: ${firstName} ${lastName} – ${procedure} (${dur} мин)`;
    const description = `Име: ${firstName} ${lastName}
Имейл: ${email}
Телефон: ${phone}
Процедура: ${procedure}
Симптоми: ${symptoms || "—"}
Терапевт: ${therapistName}
Обект: ${officeName}
Източник: Уебсайт`;

    const therapistContactPhone = resolvedTherapistKey
      ? getTherapistDefinition(resolvedTherapistKey).contactPhone
      : officePhone;
    const SEND_GCAL_INVITE = String(process.env.SEND_GCAL_INVITE).toLowerCase() === "true";

    const eventRequestBody: calendar_v3.Schema$Event = {
      summary,
      description,
      start: { dateTime: startUtc.toISOString(), timeZone: tzid },
      end: { dateTime: endUtc.toISOString(), timeZone: tzid },
      location: address,
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
    };
    if (SEND_GCAL_INVITE && hasValidEmail) eventRequestBody.attendees = [{ email }];

    const reviewDelayMinutes = readPositiveIntegerEnv("REVIEW_DELAY_MINUTES", 15);
    const bookingCreatedAt = new Date();
    const suppressReminder = shouldSuppressReminderForRecentBooking(
      startUtc,
      bookingCreatedAt
    );
    const reminderSchedule = getReminderDueAtForAppointment(startUtc);
    const reminderKind = reminderSchedule.smsKind;
    const reminderLeadMinutes = Math.max(
      0,
      Math.round((startUtc.getTime() - reminderSchedule.dueAt.getTime()) / 60_000)
    );
    const reviewDueAtISO = new Date(
      endUtc.getTime() + reviewDelayMinutes * 60 * 1000
    ).toISOString();
    const reminderDueAtISO = reminderSchedule.dueAt.toISOString();

    let privateMetadata: Record<string, string> = {
      reviewDueAt: reviewDueAtISO,
      reviewDelayMinutes: String(reviewDelayMinutes),
      reviewEmailSent: "0",
      reviewSmsSent: "0",
      reminderDueAt: reminderDueAtISO,
      reminderLeadMinutes: String(reminderLeadMinutes),
      reminderSmsSent: "0",
      reminder_sms_suppressed: suppressReminder ? "1" : "0",
      reminder_sms_suppressed_reason: suppressReminder
        ? "booked-same-or-previous-day"
        : "",
      booking_created_at: bookingCreatedAt.toISOString(),
      customerEmail: email,
      customerFirstName: firstName,
      customerLastName: lastName || "",
      customerPhone: phone,
      procedureName: procedure,
      therapistName,
      officeKey: location,
      officeName,
      officeAddress: address,
      officeMapsUrl: mapsUrl,
      officeMapsSmsUrl,
      officePhone,
      bookingSource: "website",
      patient_phone: normalizePhone(phone) || phone,
      sms_consent: "0",
      review_sms_consent: reviewSmsConsentEnabled ? "1" : "0",
      therapist_id: resolvedTherapistKey || therapist || "",
      location_id: locationId,
      location_label: locationLabel,
      appointment_start: startUtc.toISOString(),
      appointment_end: endUtc.toISOString(),
      appointment_status: "scheduled",
      google_calendar_event_id: "",
      appointment_id: "",
      reminder_sms_scheduled_id: "",
      same_day_reminder_sms_scheduled_id: "",
      review_sms_scheduled_id: "",
      review_requested_at: "",
      manage_booking_link: manageBookingLink,
      review_link: officeReviewLink,
      same_day_reminder_enabled: "0",
      same_day_reminder_lead_minutes: "0",
      same_day_reminder_due_at: "",
      is_returning_patient: returningPatient ? "1" : "0",
      confirmation_sms_sent: "0",
      confirmation_sms_skipped_reason: "sms-disabled",
      reminderEmailSent: "0",
      reminder_email_scheduled_id: "",
      reminder_email_suppressed: suppressReminder ? "1" : "0",
      reminder_email_suppressed_reason: suppressReminder
        ? "booked-same-or-previous-day"
        : "",
    };

    eventRequestBody.extendedProperties = {
      private: privateMetadata,
    };

    console.log("[BOOK] stage: create-event");
    const created = await cal.events.insert({
      calendarId: calId,
      ...(SEND_GCAL_INVITE ? { sendUpdates: "all" as const } : {}),
      requestBody: eventRequestBody,
    });
    const eventId = created.data.id || "";
    console.log("[BOOK] stage: event-inserted", eventId);

    privateMetadata = {
      ...privateMetadata,
      appointment_id: eventId,
      google_calendar_event_id: eventId,
      reminder_email_scheduled_id: suppressReminder
        ? ""
        : buildReminderScheduledId(eventId, reminderKind, startUtc),
      reminder_sms_scheduled_id: "",
      same_day_reminder_sms_scheduled_id: "",
      review_sms_scheduled_id: buildReviewScheduledId(
        eventId,
        "review_request_after_completed_appointment",
        endUtc
      ),
    };

    const confirmationSmsOk = true;
    const confirmationSmsErr = "";

    let sheetsOk = true;
    let sheetsErr: string | undefined;
    try {
      const sheetsClient = sheets ?? getSheets();
      const sheetConfig = getSheetConfigForOffice(location);
      const spreadsheetId = sheetConfig.spreadsheetId;
      const sheetName = sheetConfig.bookingTabName;
      const reviewDirectoryTabName = sheetConfig.reviewDirectoryTabName;
      if (!spreadsheetId) throw new Error("Липсва SHEETS_SPREADSHEET_ID");

      const timestamp = new Intl.DateTimeFormat("bg-BG", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: tzid,
      }).format(new Date());

      await ensureSheetWithHeaders(
        sheetsClient,
        spreadsheetId,
        sheetName,
        BOOKING_SHEET_HEADERS
      );

      console.log("[BOOK] stage: sheets-append");
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[
            timestamp,
            date,
            time,
            dur,
            firstName,
            lastName,
            email,
            phone,
            procedure,
            symptoms || "",
            eventId,
            therapistName,
            officeName,
            "website",
          ]],
        },
      });

      await ensureSheetWithHeaders(
        sheetsClient,
        spreadsheetId,
        reviewDirectoryTabName,
        REVIEW_DIRECTORY_HEADERS
      );

      const directoryName = `${firstName} ${lastName}`.trim().replace(/\s+/g, " ");
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range: `${reviewDirectoryTabName}!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[
            directoryName,
            phone,
            email,
            `${date} ${time}`,
            getNameCategoryLetter(directoryName),
          ]],
        },
      });
      console.log("[BOOK] stage: sheets-done");
    } catch (err: unknown) {
      sheetsOk = false;
      sheetsErr = err instanceof Error ? err.message : String(err);
      console.error("[BOOK] Sheets append failed:", sheetsErr);
    }

    let emailOk = false;
    let emailErr: string | undefined;
    if (!hasValidEmail) {
      emailErr = "No valid email address was provided.";
      privateMetadata.confirmation_email_skipped_reason = "missing-or-invalid-email";
    } else try {
      console.log("[BOOK] stage: send-email");

      const calendarTitle = `DM PHYSIO - ${procedure}`;
      const calendarDetails = [
        `Обект: ${officeName}`,
        `Терапевт: ${therapistName}`,
        `Процедура: ${procedure}`,
        `Дата: ${dateText}`,
        `Час: ${timeText}`,
      ].join("\n");
      const googleDates = `${toUtcGoogleDateTime(startISO)}/${toUtcGoogleDateTime(endISO)}`;
      const googleCalendarUrl =
        `https://calendar.google.com/calendar/render?` +
        new URLSearchParams({
          action: "TEMPLATE",
          text: calendarTitle,
          dates: googleDates,
          details: calendarDetails,
          location: address,
          ctz: tzid,
        }).toString();
      const iosCalendarUrl =
        `${bookingOrigin}/api/calendar/ics?` +
        new URLSearchParams({
          title: calendarTitle,
          start: startISO,
          end: endISO,
          location: address,
          details: calendarDetails,
        }).toString();

      await sendBookingEmailSMTP({
        to: email,
        from: process.env.EMAIL_FROM || "DM PHYSIO <dmphysio369@gmail.com>",
        subject: "Потвърждение за запазен час – DM PHYSIO",
        firstName,
        lastName,
        dateText,
        timeText,
        therapist: resolvedTherapistKey ? therapistName : undefined,
        procedure,
        phone,
        businessPhone: therapistContactPhone,
        address,
        notes: symptoms,
        eventUid: eventId || undefined,
        startISO,
        endISO,
        tzid,
        extraHtml: `
          <p style="margin-top:12px;"><strong>Обект:</strong> ${officeName}</p>
          <p style="margin-top:16px;">
            <a href="${mapsUrl}" target="_blank"
               style="display:inline-block;margin-top:8px;padding:10px 16px;
                      background:#00c4c4;color:#fff;font-weight:bold;
                      border-radius:8px;text-decoration:none;">
              Навигация с Google Maps
            </a>
          </p>
          <p style="margin-top:10px;">
            <a href="${googleCalendarUrl}" target="_blank"
               style="display:inline-block;padding:10px 16px;
                      background:#16a34a;color:#fff;font-weight:bold;
                      border-radius:8px;text-decoration:none;">
              Add to Google Calendar
            </a>
          </p>
          <p style="margin-top:10px;">
            <a href="${iosCalendarUrl}" target="_blank"
               style="display:inline-block;padding:10px 16px;
                      background:#2563eb;color:#fff;font-weight:bold;
                      border-radius:8px;text-decoration:none;">
              Add to iOS Calendar
            </a>
          </p>
        `,
      });

      emailOk = true;
      privateMetadata.confirmation_email_sent = "1";
      privateMetadata.confirmation_email_sent_at = new Date().toISOString();
      privateMetadata.confirmation_delivery_channel = "email";
      console.log("[BOOK] stage: email-sent");
    } catch (e: unknown) {
      emailOk = false;
      emailErr = e instanceof Error ? e.message : String(e);
      privateMetadata.confirmation_email_error = emailErr.slice(0, 250);
      console.error("[BOOK] Email send failed:", emailErr);
    }

    if (eventId) {
      try {
        await cal.events.patch({
          calendarId: calId,
          eventId,
          requestBody: {
            extendedProperties: {
              private: privateMetadata,
            },
          },
        });
      } catch (error) {
        console.error("[BOOK] Metadata patch failed:", error);
      }
    }

    return NextResponse.json({
      ok: true,
      eventId,
      sheetsOk,
      sheetsErr,
      confirmationSmsOk,
      confirmationSmsErr,
      emailOk,
      emailErr,
      therapistKey: resolvedTherapistKey,
    });
  } catch (e) {
    console.error("[BOOK] ERROR:", e);
    const message = e instanceof Error ? e.message : "Грешка при записването.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
