import { NextRequest, NextResponse } from "next/server";
import { getCalendar, getSheets } from "@/app/lib/google";
import { getManagedOffices } from "@/app/lib/booking-config.server";
import { sendReviewRequestEmailSMTP } from "@/app/lib/email";
import {
  REVIEW_DIRECTORY_HEADERS,
  ensureSheetWithHeaders,
  getSheetConfigForOffice,
} from "@/app/lib/sheets-config.server";
import {
  buildReviewScheduledId,
  deriveAppointmentStatus,
  getReviewLinkForOffice,
  readPositiveIntegerEnv,
} from "@/app/lib/appointment-communications";
import {
  type PatientVisitRecord,
  type ReviewPrivateProps,
  buildPatientVisitIndex,
  buildReviewEventKey,
  buildReviewMilestoneKey,
  extractReviewEmail,
  extractReviewName,
  extractReviewPhone,
  getReviewEventStartMs,
  getReviewPrivateProps,
  isReviewMilestone,
  normalizeReviewEmail,
} from "@/app/lib/review-policy";
import {
  appendReviewRequestLog,
  readReviewHistory,
  type ReviewHistory,
} from "@/app/lib/review-log.server";
import { createReviewTrackingToken } from "@/app/lib/review-tracking.server";
import { getBookingUrl, getShortReviewUrl } from "@/app/lib/site";
import {
  isReviewSmsConfigured,
  normalizePhone,
  sendReviewRequestSMS,
} from "@/app/lib/sms";

type CalendarReviewPrivateProps = ReviewPrivateProps & {
  appointment_status?: string;
  appointment_id?: string;
  appointment_start?: string;
  appointment_end?: string;
  google_calendar_event_id?: string;
  patient_phone?: string;
  customerPhone?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  reviewSmsTo?: string;
  reviewDueAt?: string;
  reviewDelayMinutes?: string;
  reviewSmsSent?: string;
  reviewSmsSentAt?: string;
  reviewSmsSid?: string;
  reviewSmsError?: string;
  reviewSmsLastAttemptAt?: string;
  reviewEmailSent?: string;
  reviewEmailSentAt?: string;
  reviewEmailMessageId?: string;
  reviewEmailError?: string;
  reviewEmailLastAttemptAt?: string;
  review_requested_at?: string;
  review_sms_scheduled_id?: string;
  review_visit_number?: string;
  review_skip_reason?: string;
  review_skipped_at?: string;
  review_tracking_url?: string;
  review_delivery_channel?: string;
  location_id?: string;
  officeKey?: string;
};

function getPrivateProps(ev: {
  extendedProperties?: { private?: Record<string, string> | null } | null;
}): CalendarReviewPrivateProps {
  return getReviewPrivateProps(ev) as CalendarReviewPrivateProps;
}

function serializePrivateProps(priv: CalendarReviewPrivateProps) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(priv)) {
    if (typeof value === "string") cleaned[key] = value;
  }
  return cleaned;
}

function isAuthorized(req: NextRequest) {
  const envSecret = (process.env.CRON_SECRET || "").trim();

  const rawHeader = (req.headers.get("authorization") || "").trim();
  const headerToken = rawHeader.toLowerCase().startsWith("bearer ")
    ? rawHeader.slice(7).trim()
    : "";
  const bearerOk = headerToken === envSecret;

  const url = new URL(req.url);
  const queryToken = (url.searchParams.get("secret") || "").trim();
  const queryOk = queryToken === envSecret;

  const vercelCron = req.headers.has("x-vercel-cron");

  return bearerOk || queryOk || vercelCron;
}

function parseBool(value: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function normalizeTenDigitPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10 && digits.startsWith("0")) return digits;
  if (digits.length === 9 && digits.startsWith("8")) return `0${digits}`;
  if (digits.length === 12 && digits.startsWith("3598")) return `0${digits.slice(3)}`;
  if (digits.length === 14 && digits.startsWith("003598")) return `0${digits.slice(5)}`;
  return "";
}

function extractTenDigitPhones(text?: string | null) {
  if (!text) return [];
  const matches = text.match(/(?:\+359|00359|0)?\s*8\d(?:[\s\-()]*\d){7}/g) ?? [];
  const phones = new Set<string>();
  for (const match of matches) {
    const phone = normalizeTenDigitPhone(match);
    if (phone) phones.add(phone);
  }
  return [...phones];
}

function extractTenDigitPhoneFromEvent(
  priv: ReviewPrivateProps,
  summary?: string | null,
  description?: string | null
) {
  const directCandidates = [priv.patient_phone || "", priv.customerPhone || "", priv.reviewSmsTo || ""];
  for (const raw of directCandidates) {
    const phone = normalizeTenDigitPhone(raw);
    if (phone) return phone;
  }

  const fromDescription = extractTenDigitPhones(description);
  if (fromDescription.length > 0) return fromDescription[0];

  const fromSummary = extractTenDigitPhones(summary);
  if (fromSummary.length > 0) return fromSummary[0];

  return "";
}

function formatDirectoryBookedAt(start?: {
  dateTime?: string | null;
  date?: string | null;
}) {
  if (start?.dateTime) {
    const d = new Date(start.dateTime);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Sofia",
      }).format(d);
    }
  }

  if (start?.date) return start.date;
  return "";
}

function getNameCategoryLetter(name: string) {
  const trimmed = name.trim();
  for (const ch of trimmed) {
    if (/\p{L}/u.test(ch)) return ch.toUpperCase();
  }
  return "#";
}

function setPropIfChanged(
  priv: ReviewPrivateProps,
  key: string,
  value: string
) {
  if ((priv[key] || "") === value) return false;
  priv[key] = value;
  return true;
}

function getReviewDueAt(
  priv: ReviewPrivateProps,
  end: Date,
  defaultDelayMinutes: number
) {
  const delayMinutes = Math.max(
    defaultDelayMinutes,
    readPositiveIntegerEnv("REVIEW_DELAY_MINUTES", defaultDelayMinutes)
  );
  const stored = priv.reviewDueAt ? new Date(priv.reviewDueAt) : null;
  const computed = new Date(end.getTime() + delayMinutes * 60 * 1000);

  if (stored && !Number.isNaN(stored.getTime())) {
    const deltaMs = Math.abs(stored.getTime() - computed.getTime());
    if (deltaMs <= 60_000) {
      return { dueAt: stored, delayMinutes };
    }
  }

  return { dueAt: computed, delayMinutes };
}

function getReviewAutomationStartAt() {
  const raw = (process.env.REVIEW_AUTOMATION_START_AT || "").trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function readBookingContactsFromSheet(args: {
  sheets: ReturnType<typeof getSheets>;
  spreadsheetId: string;
  tabName: string;
}) {
  const contacts = new Map<string, { name: string; email: string }>();

  try {
    const response = await args.sheets.spreadsheets.values.get({
      spreadsheetId: args.spreadsheetId,
      range: `${args.tabName}!A2:N`,
    });

    for (const row of response.data.values || []) {
      const phone = normalizePhone(String(row[7] || ""));
      const email = normalizeReviewEmail(String(row[6] || ""));
      if (!phone || !email) continue;

      const name = `${String(row[4] || "").trim()} ${String(row[5] || "").trim()}`
        .trim()
        .replace(/\s+/g, " ");
      contacts.set(phone, {
        name: name || "Неизвестен",
        email,
      });
    }
  } catch {
    // Missing legacy tabs should not stop the review scan.
  }

  return contacts;
}

async function ensureReviewSmsSheet(
  sheets: ReturnType<typeof getSheets>,
  spreadsheetId: string,
  tabName: string
) {
  await ensureSheetWithHeaders(sheets, spreadsheetId, tabName, REVIEW_DIRECTORY_HEADERS);
}

async function syncDirectorySheetFromCalendar(args: {
  calendar: ReturnType<typeof getCalendar>;
  managedOffice: ReturnType<typeof getManagedOffices>[number];
  sheets: ReturnType<typeof getSheets>;
  spreadsheetId: string;
  tabName: string;
  writeSheet?: boolean;
}) {
  const byPhone = new Map<
    string,
    {
      name: string;
      email: string;
      bookedAt: string;
      sortMs: number;
      category: string;
    }
  >();
  const visits: PatientVisitRecord[] = [];

  let pageToken: string | undefined;

  do {
    const res = await args.calendar.events.list({
      calendarId: args.managedOffice.calendarId,
      timeMin: "2010-01-01T00:00:00Z",
      timeMax: "2100-01-01T00:00:00Z",
      singleEvents: true,
      orderBy: "startTime",
      pageToken,
    });
    pageToken = res.data.nextPageToken || undefined;

    for (const ev of res.data.items || []) {
      if (ev.status === "cancelled" || !ev.id) continue;

      const priv = getPrivateProps(ev);
      const explicitStatus = (priv.appointment_status || "").trim().toLowerCase();
      if (explicitStatus === "cancelled" || explicitStatus === "no_show") {
        continue;
      }
      const phone = extractReviewPhone(priv, ev.summary, ev.description);
      const directoryPhone = extractTenDigitPhoneFromEvent(
        priv,
        ev.summary,
        ev.description
      );
      if (!phone || !directoryPhone) continue;

      const name = extractReviewName(priv, ev.summary);
      const email = extractReviewEmail(
        priv,
        ev.description,
        ev.attendees
      );
      const bookedAt = formatDirectoryBookedAt(ev.start);
      const category = getNameCategoryLetter(name);

      const sortSource = ev.start?.dateTime || ev.start?.date || ev.created || "";
      const sortMs = Number.isNaN(new Date(sortSource).getTime())
        ? Number.MIN_SAFE_INTEGER
        : new Date(sortSource).getTime();

      visits.push({
        eventId: ev.id,
        officeKey: args.managedOffice.officeKey,
        phone,
        name,
        email,
        startMs: getReviewEventStartMs(ev),
        clickedReviewLink: priv.review_link_clicked === "1",
        sentReviewRequest:
          priv.reviewEmailSent === "1" || priv.reviewSmsSent === "1",
      });

      const prev = byPhone.get(directoryPhone);
      if (!prev || sortMs > prev.sortMs) {
        byPhone.set(directoryPhone, {
          name,
          email: email || prev?.email || "",
          bookedAt,
          sortMs,
          category,
        });
      } else if (email && !prev.email) {
        byPhone.set(directoryPhone, { ...prev, email });
      }
    }
  } while (pageToken);

  const rows = [...byPhone.entries()]
    .map(
      ([phone, data]) =>
        [data.name, phone, data.email, data.bookedAt, data.category, data.sortMs] as const
    )
    .sort(
      (a, b) =>
        b[5] - a[5] ||
        a[4].localeCompare(b[4], "bg", { sensitivity: "base" }) ||
        a[0].localeCompare(b[0], "bg", { sensitivity: "base" }) ||
        a[1].localeCompare(b[1], "bg", { sensitivity: "base" })
    )
    .map((r) => [r[0], r[1], r[2], r[3], r[4]]);

  if (args.writeSheet !== false) {
    await args.sheets.spreadsheets.values.clear({
      spreadsheetId: args.spreadsheetId,
      range: `${args.tabName}!A2:E`,
    });

    if (rows.length > 0) {
      await args.sheets.spreadsheets.values.update({
        spreadsheetId: args.spreadsheetId,
        range: `${args.tabName}!A2:E`,
        valueInputOption: "RAW",
        requestBody: { values: rows },
      });
    }
  }

  return { rowsWritten: rows.length, visits };
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = parseBool(url.searchParams.get("dryRun"));

  const managedOffices = getManagedOffices();
  if (managedOffices.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No configured booking calendars." },
      { status: 500 }
    );
  }

  const calendar = getCalendar();
  const sheets = getSheets();
  const now = new Date();
  const reviewAutomationStartAt = getReviewAutomationStartAt();
  if (!reviewAutomationStartAt) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "REVIEW_AUTOMATION_START_AT must be configured with a valid ISO date before review delivery is enabled.",
      },
      { status: 503 }
    );
  }
  const reviewSmsConfigured = isReviewSmsConfigured();
  const defaultReviewDelayMinutes = Math.max(
    15,
    readPositiveIntegerEnv("REVIEW_DELAY_MINUTES", 15)
  );
  const officeSheetConfigs = managedOffices.map((managedOffice) => ({
    managedOffice,
    sheetConfig: getSheetConfigForOffice(managedOffice.officeKey),
  }));
  const officeSheetConfigMap = new Map(
    officeSheetConfigs.map(({ managedOffice, sheetConfig }) => [managedOffice.officeKey, sheetConfig])
  );
  let directoryRowsWritten = 0;
  const directorySheets: Array<{
    officeKey: string;
    spreadsheetId: string;
    tabName: string;
    rowsWritten: number;
  }> = [];
  const allVisits: PatientVisitRecord[] = [];
  const bookingContacts = new Map<
    string,
    { name: string; email: string }
  >();
  const reviewHistory: ReviewHistory = {
    legacyBlockedPhones: new Set<string>(),
    clickedPhones: new Set<string>(),
    sentMilestones: new Set<string>(),
    sentEventIds: new Set<string>(),
  };

  for (const { managedOffice, sheetConfig } of officeSheetConfigs) {
    if (!sheetConfig.spreadsheetId) continue;

    if (!dryRun) {
      await ensureReviewSmsSheet(
        sheets,
        sheetConfig.spreadsheetId,
        sheetConfig.reviewDirectoryTabName
      );
    }
    const syncRes = await syncDirectorySheetFromCalendar({
      calendar,
      managedOffice,
      sheets,
      spreadsheetId: sheetConfig.spreadsheetId,
      tabName: sheetConfig.reviewDirectoryTabName,
      writeSheet: !dryRun,
    });
    directoryRowsWritten += syncRes.rowsWritten;
    allVisits.push(...syncRes.visits);
    directorySheets.push({
      officeKey: managedOffice.officeKey,
      spreadsheetId: sheetConfig.spreadsheetId,
      tabName: sheetConfig.reviewDirectoryTabName,
      rowsWritten: syncRes.rowsWritten,
    });

    const officeHistory = await readReviewHistory({
      sheets,
      spreadsheetId: sheetConfig.spreadsheetId,
      tabName: sheetConfig.reviewSentLogTabName,
      ensureSheet: !dryRun,
    });
    for (const phone of officeHistory.legacyBlockedPhones) {
      reviewHistory.legacyBlockedPhones.add(phone);
    }
    for (const phone of officeHistory.clickedPhones) {
      reviewHistory.clickedPhones.add(phone);
    }
    for (const milestone of officeHistory.sentMilestones) {
      reviewHistory.sentMilestones.add(milestone);
    }
    for (const eventId of officeHistory.sentEventIds) {
      reviewHistory.sentEventIds.add(eventId);
    }

    const officeBookingContacts = await readBookingContactsFromSheet({
      sheets,
      spreadsheetId: sheetConfig.spreadsheetId,
      tabName: sheetConfig.bookingTabName,
    });
    for (const [phone, contact] of officeBookingContacts) {
      bookingContacts.set(phone, contact);
    }
  }

  const patientVisitIndex = buildPatientVisitIndex(allVisits);
  for (const phone of patientVisitIndex.clickedPhones) {
    reviewHistory.clickedPhones.add(phone);
  }
  for (const milestone of patientVisitIndex.sentMilestones) {
    reviewHistory.sentMilestones.add(milestone);
  }
  for (const [phone, contact] of bookingContacts) {
    const existing = patientVisitIndex.contactByPhone.get(phone);
    patientVisitIndex.contactByPhone.set(phone, {
      name:
        existing?.name && existing.name !== "Неизвестен"
          ? existing.name
          : contact.name,
      email: existing?.email || contact.email,
    });
  }

  const timeMin = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = now.toISOString();

  let processed = 0;
  let eligibleEmail = 0;
  let emailSent = 0;
  let failedEmail = 0;
  let eligibleSms = 0;
  let smsSent = 0;
  let failedSms = 0;
  let skippedMissingData = 0;
  let skippedBeforeAutomationStart = 0;
  let skippedNotDue = 0;
  let skippedAlreadySent = 0;
  let skippedMissingPhone = 0;
  let skippedReviewEmailMissing = 0;
  let skippedReviewSmsUnavailable = 0;
  let skippedNotCompleted = 0;
  let skippedNotMilestone = 0;
  let skippedLegacyReviewList = 0;
  let skippedMilestoneAlreadySent = 0;
  let metadataUpdated = 0;

  for (const managedOffice of managedOffices) {
    let pageToken: string | undefined;

    do {
      const res = await calendar.events.list({
        calendarId: managedOffice.calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        pageToken,
      });
      pageToken = res.data.nextPageToken || undefined;

      for (const ev of res.data.items || []) {
        processed++;
        if (!ev.id) {
          skippedMissingData++;
          continue;
        }

        const startISO = ev.start?.dateTime || ev.start?.date;
        const endISO = ev.end?.dateTime || ev.end?.date;
        if (!startISO || !endISO) {
          skippedMissingData++;
          continue;
        }

        const start = new Date(startISO);
        const end = new Date(endISO);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          skippedMissingData++;
          continue;
        }

        const normalizedStartIso = start.toISOString();
        const normalizedEndIso = end.toISOString();

        if (end < reviewAutomationStartAt) {
          skippedBeforeAutomationStart++;
          continue;
        }

        const originalPrivateProps = getPrivateProps(ev);
        const privatePatch: CalendarReviewPrivateProps = { ...originalPrivateProps };
        let shouldPatch = false;

        const status = deriveAppointmentStatus({
          explicitStatus: privatePatch.appointment_status,
          googleEventStatus: ev.status,
          appointmentEnd: end,
          now,
        });
        shouldPatch =
          setPropIfChanged(privatePatch, "appointment_status", status) || shouldPatch;
        shouldPatch =
          setPropIfChanged(privatePatch, "appointment_id", ev.id) || shouldPatch;
        shouldPatch =
          setPropIfChanged(privatePatch, "google_calendar_event_id", ev.id) || shouldPatch;
        shouldPatch =
          setPropIfChanged(privatePatch, "appointment_start", normalizedStartIso) || shouldPatch;
        shouldPatch =
          setPropIfChanged(privatePatch, "appointment_end", normalizedEndIso) || shouldPatch;
        shouldPatch =
          setPropIfChanged(
            privatePatch,
            "review_sms_scheduled_id",
            buildReviewScheduledId(
              ev.id,
              "review_request_after_completed_appointment",
              normalizedEndIso
            )
          ) || shouldPatch;

        if (status !== "completed") {
          skippedNotCompleted++;
          if (status === "cancelled" || status === "no_show") {
            shouldPatch =
              setPropIfChanged(privatePatch, "review_sms_scheduled_id", "") || shouldPatch;
          }
          if (!dryRun && shouldPatch) {
            await calendar.events.patch({
              calendarId: managedOffice.calendarId,
              eventId: ev.id,
              requestBody: {
                extendedProperties: { private: serializePrivateProps(privatePatch) },
              },
            });
            metadataUpdated++;
          }
          continue;
        }

        const { dueAt: reviewDueAt, delayMinutes } = getReviewDueAt(
          privatePatch,
          end,
          defaultReviewDelayMinutes
        );
        shouldPatch =
          setPropIfChanged(privatePatch, "reviewDueAt", reviewDueAt.toISOString()) || shouldPatch;
        shouldPatch =
          setPropIfChanged(privatePatch, "reviewDelayMinutes", String(delayMinutes)) || shouldPatch;

        if (
          privatePatch.reviewSmsSent === "1" ||
          privatePatch.reviewEmailSent === "1"
        ) {
          skippedAlreadySent++;
          if (!dryRun && shouldPatch) {
            await calendar.events.patch({
              calendarId: managedOffice.calendarId,
              eventId: ev.id,
              requestBody: {
                extendedProperties: { private: serializePrivateProps(privatePatch) },
              },
            });
            metadataUpdated++;
          }
          continue;
        }

        if (now < reviewDueAt) {
          skippedNotDue++;
          if (!dryRun && shouldPatch) {
            await calendar.events.patch({
              calendarId: managedOffice.calendarId,
              eventId: ev.id,
              requestBody: {
                extendedProperties: { private: serializePrivateProps(privatePatch) },
              },
            });
            metadataUpdated++;
          }
          continue;
        }

        const customerPhone = extractReviewPhone(
          privatePatch,
          ev.summary,
          ev.description
        );
        if (!customerPhone) {
          skippedMissingPhone++;
          continue;
        }

        const eventKey = buildReviewEventKey(managedOffice.officeKey, ev.id);
        const visitNumber =
          patientVisitIndex.visitNumberByEvent.get(eventKey) || 1;
        shouldPatch =
          setPropIfChanged(
            privatePatch,
            "review_visit_number",
            String(visitNumber)
          ) || shouldPatch;

        const skipReview = async (reason: string) => {
          const reasonChanged = setPropIfChanged(
            privatePatch,
            "review_skip_reason",
            reason
          );
          shouldPatch = reasonChanged || shouldPatch;
          if (reasonChanged || !privatePatch.review_skipped_at) {
            shouldPatch =
              setPropIfChanged(
                privatePatch,
                "review_skipped_at",
                now.toISOString()
              ) || shouldPatch;
          }

          if (!dryRun && shouldPatch) {
            await calendar.events.patch({
              calendarId: managedOffice.calendarId,
              eventId: ev.id!,
              requestBody: {
                extendedProperties: {
                  private: serializePrivateProps(privatePatch),
                },
              },
            });
            metadataUpdated++;
          }
        };

        if (!isReviewMilestone(visitNumber)) {
          skippedNotMilestone++;
          await skipReview("not-visit-1-or-5");
          continue;
        }

        if (reviewHistory.legacyBlockedPhones.has(customerPhone)) {
          skippedLegacyReviewList++;
          await skipReview("legacy-review-list");
          continue;
        }

        const milestoneKey = buildReviewMilestoneKey(
          customerPhone,
          visitNumber
        );
        if (
          reviewHistory.sentMilestones.has(milestoneKey) ||
          reviewHistory.sentEventIds.has(ev.id)
        ) {
          skippedMilestoneAlreadySent++;
          await skipReview("visit-review-already-sent");
          continue;
        }

        const reviewLink = getReviewLinkForOffice(managedOffice.officeKey);
        if (!reviewLink) {
          skippedMissingData++;
          continue;
        }

        const contact = patientVisitIndex.contactByPhone.get(customerPhone);
        const customerEmail =
          extractReviewEmail(
            privatePatch,
            ev.description,
            ev.attendees
          ) || "";
        const deliveryChannel = customerEmail ? "email" : "sms";
        if (deliveryChannel === "email") {
          eligibleEmail++;
        } else {
          skippedReviewEmailMissing++;
          if (!reviewSmsConfigured) {
            skippedReviewSmsUnavailable++;
            await skipReview("missing-email-review-sms-disabled");
            continue;
          }
          eligibleSms++;
        }
        if (dryRun) continue;

        try {
          const sentAt = new Date().toISOString();
          const reviewSheetConfig = officeSheetConfigMap.get(managedOffice.officeKey);
          const contactName =
            extractReviewName(privatePatch, ev.summary) ||
            contact?.name ||
            "client";
          const trackingToken = createReviewTrackingToken({
            officeKey: managedOffice.officeKey,
            eventId: ev.id,
            visitNumber,
          });
          const trackingUrl =
            `${getBookingUrl().replace(/\/+$/, "")}/r/${trackingToken}`;
          if (deliveryChannel === "email") {
            const result = await sendReviewRequestEmailSMTP({
              to: customerEmail,
              firstName: (privatePatch.customerFirstName || contactName).trim(),
              lastName: (privatePatch.customerLastName || "").trim(),
              location: managedOffice.office.copy.bg.name,
              mapReviewUrl: trackingUrl,
            });
            emailSent++;
            privatePatch.reviewEmailSent = "1";
            privatePatch.reviewEmailSentAt = sentAt;
            privatePatch.reviewEmailMessageId = result.messageId || "";
            privatePatch.reviewEmailError = "";
            privatePatch.review_tracking_url = trackingUrl;
          } else {
            const result = await sendReviewRequestSMS({
              to: customerPhone,
              reviewLink: getShortReviewUrl(managedOffice.officeKey),
            });
            smsSent++;
            privatePatch.reviewSmsSent = "1";
            privatePatch.reviewSmsSentAt = sentAt;
            privatePatch.reviewSmsSid = result.sid || "";
            privatePatch.reviewSmsError = "";
            privatePatch.review_tracking_url = getShortReviewUrl(
              managedOffice.officeKey
            );
          }
          privatePatch.review_requested_at = sentAt;
          privatePatch.review_delivery_channel = deliveryChannel;
          privatePatch.review_skip_reason = "";
          privatePatch.review_skipped_at = "";
          shouldPatch = true;
          reviewHistory.sentMilestones.add(milestoneKey);
          reviewHistory.sentEventIds.add(ev.id);

          if (reviewSheetConfig?.spreadsheetId) {
            try {
              await appendReviewRequestLog({
                sheets,
                spreadsheetId: reviewSheetConfig.spreadsheetId,
                tabName: reviewSheetConfig.reviewSentLogTabName,
                sentAt,
                phone: customerPhone,
                name: contactName,
                eventId: ev.id,
                officeKey: managedOffice.officeKey,
                reviewLink,
                visitNumber,
                channel: deliveryChannel,
              });
              privatePatch.reviewEmailLogError = "";
            } catch (logError: unknown) {
              privatePatch.reviewEmailLogError =
                (logError instanceof Error
                  ? logError.message
                  : String(logError)
                ).slice(0, 250);
            }
          }
        } catch (error: unknown) {
          const errorMessage = (
            error instanceof Error ? error.message : String(error)
          ).slice(0, 250);
          if (deliveryChannel === "email") {
            failedEmail++;
            privatePatch.reviewEmailLastAttemptAt = new Date().toISOString();
            privatePatch.reviewEmailError = errorMessage;
          } else {
            failedSms++;
            privatePatch.reviewSmsLastAttemptAt = new Date().toISOString();
            privatePatch.reviewSmsError = errorMessage;
          }
          shouldPatch = true;
        }

        if (!dryRun && shouldPatch) {
          await calendar.events.patch({
            calendarId: managedOffice.calendarId,
            eventId: ev.id,
            requestBody: {
              extendedProperties: {
                private: serializePrivateProps(privatePatch),
              },
            },
          });
          metadataUpdated++;
        }
      }
    } while (pageToken);
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    processed,
    eligibleEmail,
    emailSent,
    failedEmail,
    eligibleSms,
    smsSent,
    failedSms,
    skippedMissingData,
    skippedBeforeAutomationStart,
    skippedNotDue,
    skippedAlreadySent,
    skippedMissingPhone,
    skippedReviewEmailMissing,
    skippedReviewSmsUnavailable,
    skippedNotCompleted,
    skippedNotMilestone,
    skippedLegacyReviewList,
    skippedMilestoneAlreadySent,
    metadataUpdated,
    directoryRowsWritten,
    directorySheets,
    visitRecords: allVisits.length,
    reviewDelayMinutes: defaultReviewDelayMinutes,
    reviewSmsConfigured,
    reviewAutomationStartAt: reviewAutomationStartAt.toISOString(),
    calendars: managedOffices.map((entry) => ({
      officeKey: entry.officeKey,
      calendarId: entry.calendarId,
    })),
    window: { timeMin, timeMax },
  });
}
