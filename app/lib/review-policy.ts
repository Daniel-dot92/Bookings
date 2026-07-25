import type { OfficeKey } from "@/app/lib/booking-config";
import { normalizePhone } from "@/app/lib/sms";

export type ReviewPrivateProps = Record<string, string> & {
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  patient_phone?: string;
  reviewSmsTo?: string;
  reviewEmailSent?: string;
  reviewSmsSent?: string;
  review_link_clicked?: string;
  review_link_clicked_at?: string;
};

export type ReviewCalendarEvent = {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  created?: string | null;
  start?: {
    dateTime?: string | null;
    date?: string | null;
  } | null;
  attendees?: Array<{
    email?: string | null;
  }> | null;
  extendedProperties?: {
    private?: Record<string, string> | null;
  } | null;
};

export type PatientVisitRecord = {
  eventId: string;
  officeKey: OfficeKey;
  phone: string;
  name: string;
  email: string;
  startMs: number;
  clickedReviewLink: boolean;
  sentReviewRequest: boolean;
};

export type ReviewContact = {
  name: string;
  email: string;
};

const REVIEW_MILESTONES = new Set([1, 5]);
const PHONE_PATTERN = /(?:\+359|00359|0)\s*8\d(?:[\s\-()]*\d){7}/g;

export function getReviewPrivateProps(event: ReviewCalendarEvent): ReviewPrivateProps {
  return (event.extendedProperties?.private ?? {}) as ReviewPrivateProps;
}

export function normalizeReviewEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export function extractReviewPhone(
  priv: ReviewPrivateProps,
  summary?: string | null,
  description?: string | null
) {
  for (const candidate of [
    priv.patient_phone,
    priv.customerPhone,
    priv.reviewSmsTo,
  ]) {
    const normalized = normalizePhone(candidate || "");
    if (normalized) return normalized;
  }

  for (const source of [description, summary]) {
    const match = source?.match(PHONE_PATTERN)?.[0] || "";
    const normalized = normalizePhone(match);
    if (normalized) return normalized;
  }

  return "";
}

export function extractReviewEmail(
  priv: ReviewPrivateProps,
  description?: string | null,
  attendees?: ReviewCalendarEvent["attendees"]
) {
  const direct = normalizeReviewEmail(priv.customerEmail);
  if (direct) return direct;

  const descriptionMatch =
    description?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const fromDescription = normalizeReviewEmail(descriptionMatch);
  if (fromDescription) return fromDescription;

  for (const attendee of attendees || []) {
    const email = normalizeReviewEmail(attendee.email);
    if (email) return email;
  }

  return "";
}

export function extractReviewName(
  priv: ReviewPrivateProps,
  summary?: string | null
) {
  const fromMetadata =
    `${(priv.customerFirstName || "").trim()} ${(priv.customerLastName || "").trim()}`
      .trim()
      .replace(/\s+/g, " ");
  if (fromMetadata) return fromMetadata;

  let value = (summary || "").trim();
  value = value.replace(/^Резервация:\s*/i, "");
  value = value.replace(/^Reservation:\s*/i, "");
  value = value.replace(PHONE_PATTERN, " ");
  value = value.replace(/\(\s*\d+\s*(?:мин(?:ути)?|min(?:utes?)?)\s*\)/gi, " ");
  value = value.replace(/(?:^|[\s,;|/\\()[\]{}:–—-])(?:№|#)?\s*\d{1,2}(?=$|[\s,;|/\\()[\]{}:–—-])/g, " ");
  value = value.replace(/\s+[–-]\s*$/, "");
  value = value.trim().replace(/\s+/g, " ");

  return value || "Неизвестен";
}

export function getReviewEventStartMs(event: ReviewCalendarEvent) {
  const raw = event.start?.dateTime || event.start?.date || event.created || "";
  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

export function buildReviewEventKey(officeKey: OfficeKey, eventId: string) {
  return `${officeKey}:${eventId}`;
}

export function buildReviewMilestoneKey(phone: string, visitNumber: number) {
  return `${phone}:${visitNumber}`;
}

export function isReviewMilestone(visitNumber: number) {
  return REVIEW_MILESTONES.has(visitNumber);
}

export function buildPatientVisitIndex(visits: PatientVisitRecord[]) {
  const visitsByPhone = new Map<string, PatientVisitRecord[]>();

  for (const visit of visits) {
    const patientVisits = visitsByPhone.get(visit.phone) || [];
    patientVisits.push(visit);
    visitsByPhone.set(visit.phone, patientVisits);
  }

  const visitNumberByEvent = new Map<string, number>();
  const contactByPhone = new Map<string, ReviewContact>();
  const clickedPhones = new Set<string>();
  const sentMilestones = new Set<string>();

  for (const [phone, patientVisits] of visitsByPhone) {
    patientVisits.sort(
      (left, right) =>
        left.startMs - right.startMs ||
        left.eventId.localeCompare(right.eventId)
    );

    let contact: ReviewContact = { name: "Неизвестен", email: "" };

    patientVisits.forEach((visit, index) => {
      const visitNumber = index + 1;
      visitNumberByEvent.set(
        buildReviewEventKey(visit.officeKey, visit.eventId),
        visitNumber
      );

      if (visit.name && visit.name !== "Неизвестен") {
        contact = { ...contact, name: visit.name };
      }
      if (visit.email) {
        contact = { ...contact, email: visit.email };
      }
      if (visit.clickedReviewLink) {
        clickedPhones.add(phone);
      }
      if (visit.sentReviewRequest) {
        sentMilestones.add(buildReviewMilestoneKey(phone, visitNumber));
      }
    });

    contactByPhone.set(phone, contact);
  }

  return {
    visitNumberByEvent,
    contactByPhone,
    clickedPhones,
    sentMilestones,
  };
}
