import { NextRequest, NextResponse } from "next/server";
import { getCalendar, getSheets } from "@/app/lib/google";
import { getManagedOffices } from "@/app/lib/booking-config.server";
import { sendReviewRequestEmailSMTP } from "@/app/lib/email";
import {
  REVIEW_DIRECTORY_HEADERS,
  REVIEW_SENT_LOG_HEADERS,
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
  isSmsConfigured,
  normalizePhone,
  sendReviewRequestSMS,
} from "@/app/lib/sms";

type ReviewPrivateProps = Record<string, string> & {
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
  review_sms_consent?: string;
  reviewSmsTo?: string;
  reviewDueAt?: string;
  reviewDelayMinutes?: string;
  reviewSmsSent?: string;
  reviewSmsSentAt?: string;
  reviewEmailSent?: string;
  reviewEmailSentAt?: string;
  reviewEmailMessageId?: string;
  reviewEmailError?: string;
  reviewEmailLastAttemptAt?: string;
  review_requested_at?: string;
  review_sms_scheduled_id?: string;
  location_id?: string;
  officeKey?: string;
};

function getPrivateProps(ev: {
  extendedProperties?: { private?: Record<string, string> | null } | null;
}): ReviewPrivateProps {
  return (ev.extendedProperties?.private ?? {}) as ReviewPrivateProps;
}

function serializePrivateProps(priv: ReviewPrivateProps) {
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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function extractNormalizedPhones(text?: string | null) {
  if (!text) return [];
  const matches =
    text.match(/(?:\+359|00359|0)\s*8\d(?:[\s\-()]*\d){7}/g) ?? [];

  const normalized = new Set<string>();
  for (const match of matches) {
    const phone = normalizePhone(match);
    if (phone) normalized.add(phone);
  }

  return [...normalized];
}

function extractEmailFromDescription(description?: string | null) {
  if (!description) return "";
  const match = description.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function extractPhoneFromEvent(
  priv: ReviewPrivateProps,
  summary?: string | null,
  description?: string | null
) {
  const direct = normalizePhone(priv.patient_phone || "");
  if (direct) return direct;

  const legacy = normalizePhone(priv.customerPhone || priv.reviewSmsTo || "");
  if (legacy) return legacy;

  const fromDescription = extractNormalizedPhones(description);
  if (fromDescription.length > 0) return fromDescription[0];

  const fromSummary = extractNormalizedPhones(summary);
  if (fromSummary.length > 0) return fromSummary[0];

  return "";
}

function extractEmailFromEvent(
  priv: ReviewPrivateProps,
  description?: string | null
) {
  const direct = normalizeEmail(priv.customerEmail || "");
  if (direct) return direct;

  const fromDescription = normalizeEmail(extractEmailFromDescription(description));
  if (fromDescription) return fromDescription;

  return "";
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

function extractDirectoryName(
  priv: ReviewPrivateProps,
  summary?: string | null
) {
  const fromMeta = `${(priv.customerFirstName || "").trim()} ${(priv.customerLastName || "").trim()}`
    .trim()
    .replace(/\s+/g, " ");
  if (fromMeta) return fromMeta;

  let s = (summary || "").trim();
  s = s.replace(/^Резервация:\s*/i, "");
  s = s.replace(/^Reservation:\s*/i, "");
  s = s.replace(/(?:\+359|00359|0)?\s*8\d(?:[\s\-()]*\d){7}/g, "");
  s = s.replace(/\s+[–-]\s*$/, "");
  s = s.trim().replace(/\s+/g, " ");

  return s || "Неизвестен";
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
  const delayMinutes = readPositiveIntegerEnv(
    "REVIEW_DELAY_MINUTES",
    defaultDelayMinutes
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

async function ensureReviewSmsSheet(
  sheets: ReturnType<typeof getSheets>,
  spreadsheetId: string,
  tabName: string
) {
  await ensureSheetWithHeaders(sheets, spreadsheetId, tabName, REVIEW_DIRECTORY_HEADERS);
}

async function ensureReviewSentLogSheet(
  sheets: ReturnType<typeof getSheets>,
  spreadsheetId: string,
  tabName: string
) {
  await ensureSheetWithHeaders(sheets, spreadsheetId, tabName, REVIEW_SENT_LOG_HEADERS);
}

async function readReviewSentPhonesFromSheet(args: {
  sheets: ReturnType<typeof getSheets>;
  spreadsheetId: string;
  tabName: string;
}) {
  const phones = new Set<string>();

  try {
    const response = await args.sheets.spreadsheets.values.get({
      spreadsheetId: args.spreadsheetId,
      range: `${args.tabName}!A2:F`,
    });

    for (const row of response.data.values || []) {
      const normalized = normalizePhone(String(row[1] || ""));
      if (normalized) phones.add(normalized);
    }
  } catch {
    // ignore empty or missing rows; the sheet is ensured by the caller
  }

  return phones;
}

async function appendReviewSentLog(args: {
  sheets: ReturnType<typeof getSheets>;
  spreadsheetId: string;
  tabName: string;
  sentAt: string;
  phone: string;
  name: string;
  eventId: string;
  officeKey: string;
  reviewLink: string;
}) {
  await args.sheets.spreadsheets.values.append({
    spreadsheetId: args.spreadsheetId,
    range: `${args.tabName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        args.sentAt,
        args.phone,
        args.name,
        args.eventId,
        args.officeKey,
        args.reviewLink,
      ]],
    },
  });
}

async function syncDirectorySheetFromCalendar(args: {
  calendar: ReturnType<typeof getCalendar>;
  managedOffice: ReturnType<typeof getManagedOffices>[number];
  sheets: ReturnType<typeof getSheets>;
  spreadsheetId: string;
  tabName: string;
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
      if (ev.status === "cancelled") continue;

      const priv = getPrivateProps(ev);
      const phone = extractTenDigitPhoneFromEvent(priv, ev.summary, ev.description);
      if (!phone) continue;

      const name = extractDirectoryName(priv, ev.summary);
      const email = normalizeEmail(
        priv.customerEmail || extractEmailFromDescription(ev.description)
      );
      const bookedAt = formatDirectoryBookedAt(ev.start);
      const category = getNameCategoryLetter(name);

      const sortSource = ev.start?.dateTime || ev.start?.date || ev.created || "";
      const sortMs = Number.isNaN(new Date(sortSource).getTime())
        ? Number.MIN_SAFE_INTEGER
        : new Date(sortSource).getTime();

      const prev = byPhone.get(phone);
      if (!prev || sortMs > prev.sortMs) {
        byPhone.set(phone, { name, email, bookedAt, sortMs, category });
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

  return { rowsWritten: rows.length };
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = parseBool(url.searchParams.get("dryRun"));
  const testSms = parseBool(url.searchParams.get("testSms"));
  const smsReady = isSmsConfigured();

  const managedOffices = getManagedOffices();
  if (managedOffices.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No configured booking calendars." },
      { status: 500 }
    );
  }

  if (testSms) {
    if (!smsReady) {
      return NextResponse.json(
        { ok: false, mode: "testSms", error: "SMS is not configured." },
        { status: 400 }
      );
    }

    const rawPhone = url.searchParams.get("testTo") || "";
    const to = normalizePhone(rawPhone);
    if (!to) {
      return NextResponse.json(
        { ok: false, mode: "testSms", error: "Invalid testTo phone format." },
        { status: 400 }
      );
    }

    const officeKey = managedOffices[0]?.officeKey || "studentski-grad";
    const reviewLink = getReviewLinkForOffice(officeKey) || "";
    const result = await sendReviewRequestSMS({
      to,
      firstName: (url.searchParams.get("testName") || "клиент").trim(),
      reviewLink,
    });

    return NextResponse.json({
      ok: true,
      mode: "testSms",
      to,
      sid: result.sid || "",
      reviewLink,
    });
  }

  const calendar = getCalendar();
  const sheets = getSheets();
  const now = new Date();
  const defaultReviewDelayMinutes = readPositiveIntegerEnv(
    "REVIEW_DELAY_MINUTES",
    15
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
  const reviewSentPhones = new Set<string>();

  for (const { managedOffice, sheetConfig } of officeSheetConfigs) {
    if (!sheetConfig.spreadsheetId) continue;

    await ensureReviewSmsSheet(
      sheets,
      sheetConfig.spreadsheetId,
      sheetConfig.reviewDirectoryTabName
    );
    const syncRes = await syncDirectorySheetFromCalendar({
      calendar,
      managedOffice,
      sheets,
      spreadsheetId: sheetConfig.spreadsheetId,
      tabName: sheetConfig.reviewDirectoryTabName,
    });
    directoryRowsWritten += syncRes.rowsWritten;
    directorySheets.push({
      officeKey: managedOffice.officeKey,
      spreadsheetId: sheetConfig.spreadsheetId,
      tabName: sheetConfig.reviewDirectoryTabName,
      rowsWritten: syncRes.rowsWritten,
    });

    await ensureReviewSentLogSheet(
      sheets,
      sheetConfig.spreadsheetId,
      sheetConfig.reviewSentLogTabName
    );
    const existingPhones = await readReviewSentPhonesFromSheet({
      sheets,
      spreadsheetId: sheetConfig.spreadsheetId,
      tabName: sheetConfig.reviewSentLogTabName,
    });
    for (const phone of existingPhones) reviewSentPhones.add(phone);
  }

  const timeMin = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = now.toISOString();

  let processed = 0;
  let eligibleSms = 0;
  let eligibleEmail = 0;
  let smsSent = 0;
  let emailSent = 0;
  let failedSms = 0;
  let failedEmail = 0;
  let skippedMissingData = 0;
  let skippedNotDue = 0;
  let skippedAlreadySent = 0;
  let skippedSmsMissingPhone = 0;
  let skippedReviewEmailMissing = 0;
  const skippedSmsNotConfigured = 0;
  let skippedNotCompleted = 0;
  let skippedAlreadyInReviewLog = 0;
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

        const originalPrivateProps = getPrivateProps(ev);
        const privatePatch: ReviewPrivateProps = { ...originalPrivateProps };
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

        if (privatePatch.review_sms_consent !== "1") {
          skippedMissingData++;
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
          privatePatch.reviewEmailSent === "1" ||
          privatePatch.review_requested_at
        ) {
          skippedAlreadySent++;
          const existingPhone = extractPhoneFromEvent(privatePatch, ev.summary, ev.description);
          const reviewSheetConfig = officeSheetConfigMap.get(managedOffice.officeKey);
          if (existingPhone && !reviewSentPhones.has(existingPhone)) {
            reviewSentPhones.add(existingPhone);
            if (!dryRun && reviewSheetConfig?.spreadsheetId) {
              try {
                await appendReviewSentLog({
                  sheets,
                  spreadsheetId: reviewSheetConfig.spreadsheetId,
                  tabName: reviewSheetConfig.reviewSentLogTabName,
                  sentAt:
                    privatePatch.review_requested_at ||
                    privatePatch.reviewSmsSentAt ||
                    now.toISOString(),
                  phone: existingPhone,
                  name: extractDirectoryName(privatePatch, ev.summary),
                  eventId: ev.id,
                  officeKey: managedOffice.officeKey,
                  reviewLink: getReviewLinkForOffice(managedOffice.officeKey) || "",
                });
              } catch {
                // keep going; the event itself already shows this review as sent
              }
            }
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

        const customerPhone = extractPhoneFromEvent(privatePatch, ev.summary, ev.description);
        const customerEmail = extractEmailFromEvent(privatePatch, ev.description);
        if (!customerPhone && !customerEmail) {
          skippedSmsMissingPhone++;
          skippedReviewEmailMissing++;
          continue;
        }

        if (customerPhone && reviewSentPhones.has(customerPhone)) {
          skippedAlreadyInReviewLog++;
          privatePatch.review_sms_skip_reason = "already-in-review-log";
          privatePatch.review_sms_skipped_at = now.toISOString();
          privatePatch.review_requested_at =
            privatePatch.review_requested_at || now.toISOString();
          shouldPatch = true;
          if (!dryRun) {
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

        const reviewLink = getReviewLinkForOffice(managedOffice.officeKey);
        if (!reviewLink) {
          skippedMissingData++;
          continue;
        }

        const useSms = false;
        if (!customerEmail) {
          skippedReviewEmailMissing++;
          continue;
        }

        if (useSms) {
          eligibleSms++;
        } else {
          eligibleEmail++;
        }
        if (dryRun) continue;

        try {
          const sentAt = new Date().toISOString();
          const reviewSheetConfig = officeSheetConfigMap.get(managedOffice.officeKey);
          const contactName = extractDirectoryName(privatePatch, ev.summary);

          if (useSms) {
            const result = await sendReviewRequestSMS({
              to: customerPhone!,
              firstName: (privatePatch.customerFirstName || "client").trim(),
              reviewLink,
            });
            smsSent++;
            privatePatch.reviewSmsSent = "1";
            privatePatch.reviewSmsSentAt = sentAt;
            privatePatch.review_requested_at = sentAt;
            privatePatch.reviewSmsSid = result.sid || "";
            privatePatch.reviewSmsError = "";
            shouldPatch = true;
            reviewSentPhones.add(customerPhone!);

            if (reviewSheetConfig?.spreadsheetId) {
              try {
                await appendReviewSentLog({
                  sheets,
                  spreadsheetId: reviewSheetConfig.spreadsheetId,
                  tabName: reviewSheetConfig.reviewSentLogTabName,
                  sentAt,
                  phone: customerPhone!,
                  name: contactName,
                  eventId: ev.id,
                  officeKey: managedOffice.officeKey,
                  reviewLink,
                });
                privatePatch.reviewSmsLogError = "";
              } catch (logError: unknown) {
                privatePatch.reviewSmsLogError =
                  (logError instanceof Error ? logError.message : String(logError)).slice(0, 250);
              }
            }
          } else {
            const result = await sendReviewRequestEmailSMTP({
              to: customerEmail,
              firstName: (privatePatch.customerFirstName || contactName || "client").trim(),
              lastName: (privatePatch.customerLastName || "").trim(),
              mapReviewUrl: reviewLink,
            });
            emailSent++;
            privatePatch.reviewEmailSent = "1";
            privatePatch.reviewEmailSentAt = sentAt;
            privatePatch.review_requested_at = sentAt;
            privatePatch.reviewEmailMessageId = result.messageId || "";
            privatePatch.reviewEmailError = "";
            shouldPatch = true;
          }
        } catch (error: unknown) {
          if (useSms) {
            failedSms++;
            privatePatch.reviewSmsLastAttemptAt = new Date().toISOString();
            privatePatch.reviewSmsError =
              (error instanceof Error ? error.message : String(error)).slice(0, 250);
          } else {
            failedEmail++;
            privatePatch.reviewEmailLastAttemptAt = new Date().toISOString();
            privatePatch.reviewEmailError =
              (error instanceof Error ? error.message : String(error)).slice(0, 250);
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
    eligibleSms,
    eligibleEmail,
    smsSent,
    emailSent,
    failedSms,
    failedEmail,
    skippedMissingData,
    skippedNotDue,
    skippedAlreadySent,
    skippedSmsMissingPhone,
    skippedReviewEmailMissing,
    skippedSmsNotConfigured,
    skippedNotCompleted,
    skippedAlreadyInReviewLog,
    metadataUpdated,
    directoryRowsWritten,
    directorySheets,
    smsConfigured: smsReady,
    reviewDelayMinutes: defaultReviewDelayMinutes,
    calendars: managedOffices.map((entry) => ({
      officeKey: entry.officeKey,
      calendarId: entry.calendarId,
    })),
    window: { timeMin, timeMax },
  });
}
