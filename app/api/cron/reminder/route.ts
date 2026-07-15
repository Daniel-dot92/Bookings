import { NextRequest, NextResponse } from "next/server";
import type { calendar_v3 } from "googleapis";
import { getCalendar } from "@/app/lib/google";
import { getManagedOffices } from "@/app/lib/booking-config.server";
import { THERAPIST_DEFINITIONS, type TherapistKey } from "@/app/lib/booking-config";
import {
  buildReminderScheduledId,
  deriveAppointmentStatus,
  getReminderDueAtForAppointment,
  isValidBookingEmail,
  shouldSuppressReminderForRecentBooking,
} from "@/app/lib/appointment-communications";
import {
  sendAppointmentReminderEmailSMTP,
  sendBookingEmailSMTP,
} from "@/app/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PrivateProps = Record<string, string>;

function isAuthorized(req: NextRequest) {
  const expected = (process.env.CRON_SECRET || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production";

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const querySecret = req.nextUrl.searchParams.get("secret") || "";
  return bearer === expected || querySecret === expected || req.headers.get("x-vercel-cron") === "1";
}

function getPrivateProps(event: calendar_v3.Schema$Event): PrivateProps {
  return { ...(event.extendedProperties?.private || {}) } as PrivateProps;
}

function getEventDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractEmail(event: calendar_v3.Schema$Event, priv: PrivateProps) {
  const candidates = [
    priv.patient_email,
    priv.customerEmail,
    ...(event.attendees || []).map((attendee) => attendee.email || ""),
  ];
  const descriptionMatch = (event.description || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (descriptionMatch) candidates.push(descriptionMatch[0]);
  return candidates.map((value) => value.trim()).find(isValidBookingEmail) || "";
}

function extractPatientName(event: calendar_v3.Schema$Event, priv: PrivateProps) {
  const firstName = (priv.customerFirstName || priv.firstName || "").trim();
  const lastName = (priv.customerLastName || priv.lastName || "").trim();
  if (firstName) return { firstName, lastName };

  const summary = (event.summary || "").trim();
  const reservationMatch = summary.match(/(?:Резервация|Reservation):\s*([^–-]+)/i);
  const rawName = (reservationMatch?.[1] || summary).trim();
  const parts = rawName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Клиент",
    lastName: parts.slice(1, 3).join(" "),
  };
}

function getContactPhone(priv: PrivateProps, fallback: string) {
  const therapistId = priv.therapist_id as TherapistKey | undefined;
  return (
    (therapistId && THERAPIST_DEFINITIONS[therapistId]?.contactPhone) ||
    priv.officePhone ||
    fallback
  );
}

function formatConfirmationDate(date: Date) {
  return date.toLocaleDateString("bg-BG", {
    timeZone: "Europe/Sofia",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatConfirmationTime(start: Date, end: Date) {
  const format = (date: Date) =>
    date.toLocaleTimeString("bg-BG", {
      timeZone: "Europe/Sofia",
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${format(start)}-${format(end)}`;
}

async function patchPrivateProps(args: {
  calendarId: string;
  eventId: string;
  privateProps: PrivateProps;
}) {
  await getCalendar().events.patch({
    calendarId: args.calendarId,
    eventId: args.eventId,
    requestBody: {
      extendedProperties: { private: args.privateProps },
    },
  });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const scanUntil = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const calendar = getCalendar();
  const result = {
    ok: true,
    scanned: 0,
    eligibleEmail: 0,
    confirmationEmailSent: 0,
    reminderEmailSent: 0,
    reminderSuppressed: 0,
    missingEmail: 0,
    failedEmail: 0,
  };

  for (const managed of getManagedOffices()) {
    const response = await calendar.events.list({
      calendarId: managed.calendarId,
      timeMin: now.toISOString(),
      timeMax: scanUntil.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
    });

    for (const event of response.data.items || []) {
      result.scanned += 1;
      const eventId = event.id || "";
      const start = getEventDate(event.start?.dateTime);
      const end = getEventDate(event.end?.dateTime);
      if (!eventId || !start || !end || start <= now) continue;

      const priv = getPrivateProps(event);
      const status = deriveAppointmentStatus({
        explicitStatus: priv.appointment_status,
        googleEventStatus: event.status,
        appointmentEnd: end,
        now,
      });
      if (status !== "scheduled") continue;

      const email = extractEmail(event, priv);
      if (!email) {
        result.missingEmail += 1;
        continue;
      }
      result.eligibleEmail += 1;

      const patient = extractPatientName(event, priv);
      const therapist = (priv.therapistName || "екипа на DM Physio").trim();
      const contactPhone = getContactPhone(priv, managed.office.contactPhone);
      const locationName = (priv.officeName || managed.office.copy.bg.name).trim();
      const locationUrl = (priv.officeMapsUrl || managed.office.mapsUrl).trim();
      const createdAt = getEventDate(priv.booking_created_at || event.created);
      const updates: PrivateProps = { ...priv, sms_consent: "0" };
      let changed = false;

      // The booking endpoint sends website confirmations immediately. The cron only
      // confirms newly created manual Calendar entries that contain an email address.
      const isRecentManualEvent =
        priv.bookingSource !== "website" &&
        createdAt !== null &&
        now.getTime() - createdAt.getTime() >= 0 &&
        now.getTime() - createdAt.getTime() <= 30 * 60 * 1000;
      if (isRecentManualEvent && updates.confirmation_email_sent !== "1") {
        try {
          const confirmation = await sendBookingEmailSMTP({
            to: email,
            from: process.env.EMAIL_FROM || "DM PHYSIO <dmphysio369@gmail.com>",
            subject: "Потвърждение за запазен час - DM PHYSIO",
            firstName: patient.firstName,
            lastName: patient.lastName,
            dateText: formatConfirmationDate(start),
            timeText: formatConfirmationTime(start, end),
            therapist,
            procedure: (priv.procedureName || "Терапия").trim(),
            phone: (priv.customerPhone || priv.patient_phone || "-").trim(),
            businessPhone: contactPhone,
            address: (priv.officeAddress || managed.office.copy.bg.address).trim(),
            eventUid: eventId,
            startISO: start.toISOString(),
            endISO: end.toISOString(),
            tzid: "Europe/Sofia",
            extraHtml: `<p style="margin-top:12px"><a href="${locationUrl}" target="_blank">Навигация с Google Maps</a></p>`,
          });
          updates.confirmation_email_sent = "1";
          updates.confirmation_email_sent_at = now.toISOString();
          updates.confirmation_email_message_id = confirmation.messageId || "";
          updates.confirmation_delivery_channel = "email";
          updates.confirmation_sms_skipped_reason = "sms-disabled";
          result.confirmationEmailSent += 1;
          changed = true;
        } catch (error) {
          updates.confirmation_email_error = String(error).slice(0, 250);
          result.failedEmail += 1;
          changed = true;
        }
      }

      const reminder = getReminderDueAtForAppointment(start);
      const scheduledId = buildReminderScheduledId(eventId, reminder.smsKind, start);
      const alreadySentForSchedule =
        updates.reminderEmailSent === "1" &&
        updates.reminder_email_scheduled_id === scheduledId;

      if (!alreadySentForSchedule && now >= reminder.dueAt) {
        if (createdAt && shouldSuppressReminderForRecentBooking(start, createdAt)) {
          updates.reminder_email_suppressed = "1";
          updates.reminder_email_suppressed_reason = "booked-same-or-previous-day";
          updates.reminder_email_scheduled_id = scheduledId;
          updates.reminder_sms_suppressed = "1";
          updates.reminder_sms_suppressed_reason = "sms-disabled";
          result.reminderSuppressed += 1;
          changed = true;
        } else {
          try {
            const reminderResult = await sendAppointmentReminderEmailSMTP({
              to: email,
              firstName: patient.firstName,
              date: start,
              therapist,
              location: locationName,
              locationUrl,
              contactPhone,
              kind: reminder.smsKind,
            });
            updates.reminderEmailSent = "1";
            updates.reminderEmailSentAt = now.toISOString();
            updates.reminderEmailMessageId = reminderResult.messageId || "";
            updates.reminder_email_scheduled_id = scheduledId;
            updates.reminder_email_suppressed = "0";
            updates.reminder_email_suppressed_reason = "";
            updates.reminderSmsSent = "0";
            result.reminderEmailSent += 1;
            changed = true;
          } catch (error) {
            updates.reminderEmailError = String(error).slice(0, 250);
            updates.reminderEmailLastAttemptAt = now.toISOString();
            result.failedEmail += 1;
            changed = true;
          }
        }
      }

      if (changed) {
        await patchPrivateProps({
          calendarId: managed.calendarId,
          eventId,
          privateProps: updates,
        });
      }
    }
  }

  return NextResponse.json(result);
}

