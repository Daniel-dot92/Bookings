import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { getSheets } from "@/app/lib/google";
import { sendReviewRequestEmailSMTP } from "@/app/lib/email";
import { isSmsConfigured, sendReviewRequestSMS } from "@/app/lib/sms";

const DEFAULT_GMAPS_REVIEW_URL = "https://g.page/r/CW2mjx_ste2XEBM/review";
const REVIEW_DEDUP_SINCE_ISO = "2026-03-18T00:00:00+02:00";
const REVIEW_SMS_SHEET_TAB = "Имена и тел";

type ReviewPrivateProps = Record<string, string> & {
  reviewDueAt?: string;
  reviewEmailSent?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  reviewSmsTo?: string;
  reviewSmsSent?: string;
};

function getPrivateProps(ev: {
  extendedProperties?: { private?: Record<string, string> | null } | null;
}): ReviewPrivateProps {
  return (ev.extendedProperties?.private ?? {}) as ReviewPrivateProps;
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

function normalizePhone(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00359") && digits.length === 14) {
    return `+359${digits.slice(5)}`;
  }

  if (digits.startsWith("359") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `+359${digits.slice(1)}`;
  }

  if (digits.length === 9 && digits.startsWith("8")) {
    return `+359${digits}`;
  }

  return "";
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
  const direct = normalizePhone(priv.reviewSmsTo || priv.customerPhone || "");
  if (direct) return direct;

  const fromDescription = extractNormalizedPhones(description);
  if (fromDescription.length > 0) return fromDescription[0];

  const fromSummary = extractNormalizedPhones(summary);
  if (fromSummary.length > 0) return fromSummary[0];

  return "";
}

function isWebsiteBooking(
  priv: ReviewPrivateProps,
  description?: string | null
) {
  if (priv.reviewDueAt || priv.customerEmail || priv.customerFirstName) {
    return true;
  }
  return /Източник:\s*Уебсайт/i.test(description || "");
}

function deriveFirstName(
  firstNameFromMetadata: string,
  summary?: string | null
) {
  const fromMetadata = firstNameFromMetadata.trim();
  if (fromMetadata) return fromMetadata;

  const firstToken = (summary || "").trim().split(/\s+/)[0] || "";
  return firstToken.trim();
}

function getReviewDueAt(reviewDueAtISO: string | undefined, end: Date) {
  if (reviewDueAtISO) {
    const parsed = new Date(reviewDueAtISO);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(end.getTime() + 30 * 60 * 1000);
}

async function collectAlreadySentEmails(
  calendar: ReturnType<typeof getCalendar>,
  monthsBack = 18
) {
  const now = new Date();
  const past = new Date(now);
  past.setMonth(now.getMonth() - monthsBack);

  const dedupSince = new Date(REVIEW_DEDUP_SINCE_ISO);
  const timeMin = past > dedupSince ? past.toISOString() : dedupSince.toISOString();

  const sentEmails = new Set<string>();
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId: process.env.BOOKING_CALENDAR_ID!,
      timeMin,
      timeMax: now.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      pageToken,
    });
    pageToken = res.data.nextPageToken || undefined;

    for (const ev of res.data.items || []) {
      if (ev.status === "cancelled") continue;

      const priv = getPrivateProps(ev);
      if (priv.reviewEmailSent !== "1") continue;

      const email = normalizeEmail(
        priv.customerEmail || extractEmailFromDescription(ev.description)
      );
      if (email) sentEmails.add(email);
    }
  } while (pageToken);

  return sentEmails;
}

async function collectAlreadySentPhones(
  calendar: ReturnType<typeof getCalendar>,
  monthsBack = 18
) {
  const now = new Date();
  const past = new Date(now);
  past.setMonth(now.getMonth() - monthsBack);

  const dedupSince = new Date(REVIEW_DEDUP_SINCE_ISO);
  const timeMin = past > dedupSince ? past.toISOString() : dedupSince.toISOString();

  const sentPhones = new Set<string>();
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId: process.env.BOOKING_CALENDAR_ID!,
      timeMin,
      timeMax: now.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      pageToken,
    });
    pageToken = res.data.nextPageToken || undefined;

    for (const ev of res.data.items || []) {
      if (ev.status === "cancelled") continue;

      const priv = getPrivateProps(ev);
      if (priv.reviewSmsSent !== "1") continue;

      const phone = extractPhoneFromEvent(priv, ev.summary, ev.description);
      if (phone) sentPhones.add(phone);
    }
  } while (pageToken);

  return sentPhones;
}

async function ensureReviewSmsSheet(
  sheets: ReturnType<typeof getSheets>,
  spreadsheetId: string,
  tabName: string
) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const hasTab = (spreadsheet.data.sheets || []).some(
    (s) => s.properties?.title === tabName
  );

  if (!hasTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [["timestamp", "name", "phone", "source", "eventId"]],
      },
    });
  }
}

async function collectAlreadySentPhonesFromSheet(
  sheets: ReturnType<typeof getSheets>,
  spreadsheetId: string,
  tabName: string
) {
  const sent = new Set<string>();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A2:E`,
    });

    for (const row of res.data.values || []) {
      const rawPhone = row[2] || row[1] || "";
      const phone = normalizePhone(rawPhone);
      if (phone) sent.add(phone);
    }
  } catch {
    // The tab may not exist yet; it will be created lazily when needed.
  }

  return sent;
}

async function appendSmsLogToSheet(args: {
  sheets: ReturnType<typeof getSheets>;
  spreadsheetId: string;
  tabName: string;
  name: string;
  phone: string;
  source: string;
  eventId?: string;
}) {
  await args.sheets.spreadsheets.values.append({
    spreadsheetId: args.spreadsheetId,
    range: `${args.tabName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          new Date().toISOString(),
          args.name,
          args.phone,
          args.source,
          args.eventId || "",
        ],
      ],
    },
  });
}

function serializePrivateProps(priv: ReviewPrivateProps) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(priv)) {
    if (typeof value === "string") cleaned[key] = value;
  }
  return cleaned;
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
  const tabName = process.env.REVIEW_SMS_SHEET_TAB || REVIEW_SMS_SHEET_TAB;
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID || "";

  const calendar = getCalendar();
  const sheets = getSheets();
  const now = new Date();
  const reviewUrl = DEFAULT_GMAPS_REVIEW_URL;
  const smsReady = isSmsConfigured();

  if (spreadsheetId) {
    await ensureReviewSmsSheet(sheets, spreadsheetId, tabName);
  }

  if (testSms) {
    if (!smsReady) {
      return NextResponse.json(
        { ok: false, error: "SMS not configured in environment" },
        { status: 400 }
      );
    }
    if (!spreadsheetId) {
      return NextResponse.json(
        { ok: false, error: "Missing SHEETS_SPREADSHEET_ID" },
        { status: 400 }
      );
    }

    const rawPhone = url.searchParams.get("testPhone") || "";
    const firstName = (url.searchParams.get("testName") || "Тест Клиент").trim();
    const normalizedPhone = normalizePhone(rawPhone);

    if (!normalizedPhone) {
      return NextResponse.json(
        { ok: false, error: "Invalid testPhone format" },
        { status: 400 }
      );
    }

    const smsResult = await sendReviewRequestSMS({
      to: normalizedPhone,
      firstName,
      mapReviewUrl: reviewUrl,
    });

    await appendSmsLogToSheet({
      sheets,
      spreadsheetId,
      tabName,
      name: firstName,
      phone: normalizedPhone,
      source: "manual-test",
    });

    return NextResponse.json({
      ok: true,
      mode: "testSms",
      testName: firstName,
      testPhone: normalizedPhone,
      sid: smsResult.sid || "",
      sheetTab: tabName,
    });
  }

  const sentEmails = await collectAlreadySentEmails(calendar, 18);
  const sentPhones = await collectAlreadySentPhones(calendar, 18);
  if (spreadsheetId) {
    const sentPhonesFromSheet = await collectAlreadySentPhonesFromSheet(
      sheets,
      spreadsheetId,
      tabName
    );
    for (const phone of sentPhonesFromSheet) sentPhones.add(phone);
  }

  // Look back 7 days so temporary cron outages do not miss review follow-ups.
  const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = now.toISOString();

  let pageToken: string | undefined;
  let processed = 0;
  let eligibleEmail = 0;
  let mailed = 0;
  let failedEmail = 0;
  let eligibleSms = 0;
  let smsSent = 0;
  let failedSms = 0;
  let skippedMissingData = 0;
  let skippedNotDue = 0;
  let skippedAlreadySentByEmail = 0;
  let skippedAlreadySentByPhone = 0;
  let skippedEmailMissing = 0;
  let skippedSmsMissingPhone = 0;
  let skippedSmsNotConfigured = 0;
  let websiteEventsSeen = 0;
  let nonWebsiteEventsSeen = 0;
  let smsSheetWrites = 0;

  do {
    const res = await calendar.events.list({
      calendarId: process.env.BOOKING_CALENDAR_ID!,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      pageToken,
    });
    pageToken = res.data.nextPageToken || undefined;

    const events = res.data.items || [];
    for (const ev of events) {
      processed++;
      if (ev.status === "cancelled") continue;
      if (!ev.id) {
        skippedMissingData++;
        continue;
      }

      const priv = getPrivateProps(ev);
      const reviewEmailSentAlready = priv.reviewEmailSent === "1";
      const reviewSmsSentAlready = priv.reviewSmsSent === "1";
      const firstName = deriveFirstName(priv.customerFirstName || "", ev.summary);
      const lastName = (priv.customerLastName || "").trim();
      const matchedWebsiteRule = isWebsiteBooking(priv, ev.description);
      if (matchedWebsiteRule) websiteEventsSeen++;
      else nonWebsiteEventsSeen++;

      const endISO = ev.end?.dateTime || ev.end?.date;
      if (!endISO) {
        skippedMissingData++;
        continue;
      }

      const end = new Date(endISO);
      if (Number.isNaN(end.getTime()) || end > now) {
        skippedNotDue++;
        continue;
      }

      const reviewDueAt = getReviewDueAt(priv.reviewDueAt, end);
      if (now < reviewDueAt) {
        skippedNotDue++;
        continue;
      }

      let privatePatch: ReviewPrivateProps = {
        ...priv,
        reviewDueAt: reviewDueAt.toISOString(),
      };
      let shouldPatch = false;

      if (matchedWebsiteRule && !reviewEmailSentAlready) {
        const customerEmail = normalizeEmail(
          priv.customerEmail || extractEmailFromDescription(ev.description)
        );

        if (!customerEmail) {
          skippedEmailMissing++;
        } else if (sentEmails.has(customerEmail)) {
          skippedAlreadySentByEmail++;
          privatePatch = {
            ...privatePatch,
            customerEmail,
            reviewTrigger: "website-booking",
            reviewEmailSent: "1",
            reviewEmailSkippedAt: now.toISOString(),
            reviewEmailSkipReason: "already-sent-by-email",
          };
          shouldPatch = true;
        } else {
          eligibleEmail++;
          if (!dryRun) {
            try {
              await sendReviewRequestEmailSMTP({
                to: customerEmail,
                firstName: firstName || "клиент",
                lastName,
                mapReviewUrl: reviewUrl,
              });
              mailed++;
              privatePatch = {
                ...privatePatch,
                customerEmail,
                reviewTrigger: "website-booking",
                reviewEmailSent: "1",
                reviewEmailSentAt: new Date().toISOString(),
                reviewEmailError: "",
              };
              shouldPatch = true;
              sentEmails.add(customerEmail);
            } catch (err: unknown) {
              failedEmail++;
              const message = err instanceof Error ? err.message : String(err);
              privatePatch = {
                ...privatePatch,
                customerEmail,
                reviewTrigger: "website-booking",
                reviewEmailLastAttemptAt: new Date().toISOString(),
                reviewEmailError: message.slice(0, 250),
              };
              shouldPatch = true;
            }
          }
        }
      }

      if (!matchedWebsiteRule && !reviewSmsSentAlready) {
        const customerPhone = extractPhoneFromEvent(priv, ev.summary, ev.description);

        if (!customerPhone) {
          skippedSmsMissingPhone++;
        } else if (sentPhones.has(customerPhone)) {
          skippedAlreadySentByPhone++;
          privatePatch = {
            ...privatePatch,
            reviewTrigger: "calendar-phone",
            reviewSmsTo: customerPhone,
            reviewSmsSent: "1",
            reviewSmsSkippedAt: now.toISOString(),
            reviewSmsSkipReason: "already-sent-by-phone",
          };
          shouldPatch = true;
        } else if (!smsReady) {
          skippedSmsNotConfigured++;
        } else {
          eligibleSms++;
          if (!dryRun) {
            try {
              await sendReviewRequestSMS({
                to: customerPhone,
                firstName: firstName || "клиент",
                mapReviewUrl: reviewUrl,
              });
              smsSent++;
              if (spreadsheetId) {
                await appendSmsLogToSheet({
                  sheets,
                  spreadsheetId,
                  tabName,
                  name: `${firstName || "клиент"} ${lastName}`.trim(),
                  phone: customerPhone,
                  source: "calendar-followup",
                  eventId: ev.id,
                });
                smsSheetWrites++;
              }
              privatePatch = {
                ...privatePatch,
                reviewTrigger: "calendar-phone",
                reviewSmsTo: customerPhone,
                reviewSmsSent: "1",
                reviewSmsSentAt: new Date().toISOString(),
                reviewSmsError: "",
              };
              shouldPatch = true;
              sentPhones.add(customerPhone);
            } catch (err: unknown) {
              failedSms++;
              const message = err instanceof Error ? err.message : String(err);
              privatePatch = {
                ...privatePatch,
                reviewTrigger: "calendar-phone",
                reviewSmsTo: customerPhone,
                reviewSmsLastAttemptAt: new Date().toISOString(),
                reviewSmsError: message.slice(0, 250),
              };
              shouldPatch = true;
            }
          }
        }
      }

      if (!dryRun && shouldPatch) {
        await calendar.events.patch({
          calendarId: process.env.BOOKING_CALENDAR_ID!,
          eventId: ev.id,
          requestBody: {
            extendedProperties: {
              private: serializePrivateProps(privatePatch),
            },
          },
        });
      }
    }
  } while (pageToken);

  return NextResponse.json({
    ok: true,
    dryRun,
    processed,
    eligibleEmail,
    mailed,
    failedEmail,
    eligibleSms,
    smsSent,
    failedSms,
    skippedMissingData,
    skippedNotDue,
    skippedAlreadySentByEmail,
    skippedAlreadySentByPhone,
    skippedEmailMissing,
    skippedSmsMissingPhone,
    skippedSmsNotConfigured,
    websiteEventsSeen,
    nonWebsiteEventsSeen,
    smsSheetWrites,
    sentRecipientsEmails: sentEmails.size,
    sentRecipientsPhones: sentPhones.size,
    dedupeSince: REVIEW_DEDUP_SINCE_ISO,
    smsConfigured: smsReady,
    reviewUrl,
    window: { timeMin, timeMax },
  });
}
