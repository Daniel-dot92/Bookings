import {
  type OfficeKey,
  getOfficeDefinition,
} from "@/app/lib/booking-config";
import { parseZoned } from "@/app/lib/datetime";

export type AppointmentStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no_show";

export type ReminderKind = "appointment_reminder_24h" | "appointment_reminder_same_day";
export type ReviewKind = "review_request_after_completed_appointment";

export function isValidBookingEmail(value: unknown) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(normalized)
  );
}

const LOCATION_ID_BY_OFFICE: Record<OfficeKey, string> = {
  "studentski-grad": "hristo_danov",
  "mladost-1a": "mladost",
};

export function getLocationIdForOffice(officeKey: OfficeKey) {
  return LOCATION_ID_BY_OFFICE[officeKey];
}

export function getLocationLabelForOffice(officeKey: OfficeKey) {
  return getOfficeDefinition(officeKey).copy.bg.district;
}

export function getReviewLinkForOffice(officeKey: OfficeKey) {
  const office = getOfficeDefinition(officeKey);

  if (officeKey === "studentski-grad") {
    return (
      (process.env.GMAPS_REVIEW_URL_HRISTO_DANOV || "").trim() ||
      (process.env.GMAPS_REVIEW_URL_STUDENTSKI || "").trim() ||
      (process.env.GMAPS_REVIEW_URL || "").trim() ||
      office.reviewsUrl
    );
  }

  if (officeKey === "mladost-1a") {
    return (
      (process.env.GMAPS_REVIEW_URL_MLADOST || "").trim() ||
      office.reviewsUrl
    );
  }

  return office.reviewsUrl || (process.env.GMAPS_REVIEW_URL || "").trim();
}

export function getLocationSmsLinkForOffice(officeKey: OfficeKey) {
  const office = getOfficeDefinition(officeKey);

  if (officeKey === "mladost-1a") {
    return "dmphysi0.com/m";
  }

  if (officeKey === "studentski-grad") {
    const explicit =
      (process.env.GMAPS_PLACE_URL_HRISTO_DANOV || "").trim() ||
      (process.env.GMAPS_PLACE_URL_STUDENTSKI || "").trim();
    if (explicit) return explicit;
  }

  const reviewLink = getReviewLinkForOffice(officeKey);
  if (reviewLink?.includes("g.page/") && reviewLink.endsWith("/review")) {
    return reviewLink.replace(/\/review$/, "");
  }

  if (reviewLink?.includes("g.page/")) {
    return reviewLink;
  }

  return office.mapsUrl;
}

export function buildManageBookingLink(origin: string, officeKey: OfficeKey) {
  const localePath = `/book/manage?office=${encodeURIComponent(officeKey)}`;
  return `${origin}${localePath}`;
}

export function buildOfficeMapLink(origin: string, officeKey: OfficeKey) {
  const slug = officeKey === "studentski-grad" ? "map-studentski" : "map-mladost";
  return `${origin}/r/${slug}`;
}

export function buildOfficeReviewLink(origin: string, officeKey: OfficeKey) {
  const slug = officeKey === "studentski-grad" ? "review-studentski" : "review-mladost";
  return `${origin}/r/${slug}`;
}

function getSofiaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const read = (type: string) => parts.find((part) => part.type === type)?.value || "00";

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
}

function shiftYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function shouldSuppressReminderForRecentBooking(
  appointmentStart: Date,
  bookingCreatedAt: Date
) {
  if (
    Number.isNaN(appointmentStart.getTime()) ||
    Number.isNaN(bookingCreatedAt.getTime())
  ) {
    return false;
  }

  const appointmentParts = getSofiaDateParts(appointmentStart);
  const bookingParts = getSofiaDateParts(bookingCreatedAt);
  const appointmentYmd = `${appointmentParts.year}-${appointmentParts.month}-${appointmentParts.day}`;
  const bookingYmd = `${bookingParts.year}-${bookingParts.month}-${bookingParts.day}`;

  return bookingYmd === appointmentYmd || bookingYmd === shiftYmd(appointmentYmd, -1);
}

export function getReminderDueAtForAppointment(appointmentStart: Date) {
  const parts = getSofiaDateParts(appointmentStart);
  const appointmentYmd = `${parts.year}-${parts.month}-${parts.day}`;
  const isAfterNoon = parts.hour >= 12;
  const dueDate = isAfterNoon ? appointmentYmd : shiftYmd(appointmentYmd, -1);
  const dueTime = isAfterNoon ? "09:00" : "21:00";
  const dueAt = parseZoned(dueDate, dueTime);

  return {
    dueAt,
    dueDate,
    dueTime,
    strategy: isAfterNoon ? "same_day_morning" : "previous_evening",
    smsKind: isAfterNoon
      ? ("appointment_reminder_same_day" as ReminderKind)
      : ("appointment_reminder_24h" as ReminderKind),
  } as const;
}

function toScheduleToken(value?: string | Date | null) {
  if (!value) return "";

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().replace(/[-:.]/g, "").slice(0, 15);
}

export function buildReminderScheduledId(
  eventId: string,
  kind: ReminderKind,
  appointmentStart?: string | Date | null
) {
  const token = toScheduleToken(appointmentStart);
  return token ? `${eventId}:${kind}:${token}` : `${eventId}:${kind}`;
}

export function buildReviewScheduledId(
  eventId: string,
  kind: ReviewKind = "review_request_after_completed_appointment",
  appointmentEnd?: string | Date | null
) {
  const token = toScheduleToken(appointmentEnd);
  return token ? `${eventId}:${kind}:${token}` : `${eventId}:${kind}`;
}

export function deriveAppointmentStatus(args: {
  explicitStatus?: string;
  googleEventStatus?: string | null;
  appointmentEnd?: Date | null;
  now?: Date;
}) {
  const explicit = (args.explicitStatus || "").trim().toLowerCase();
  if (explicit === "scheduled") return "scheduled" as AppointmentStatus;
  if (explicit === "completed") return "completed" as AppointmentStatus;
  if (explicit === "cancelled") return "cancelled" as AppointmentStatus;
  if (explicit === "no_show") return "no_show" as AppointmentStatus;

  if ((args.googleEventStatus || "").toLowerCase() === "cancelled") {
    return "cancelled" as AppointmentStatus;
  }

  const end = args.appointmentEnd;
  const now = args.now || new Date();
  if (end && !Number.isNaN(end.getTime()) && end <= now) {
    return "completed" as AppointmentStatus;
  }

  return "scheduled" as AppointmentStatus;
}

export function parseBooleanString(value: string | undefined, fallback = false) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function readPositiveIntegerEnv(name: string, fallback: number) {
  const raw = (process.env[name] || "").trim();
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
