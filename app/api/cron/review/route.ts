import { NextRequest, NextResponse } from "next/server";
import { getCalendar, getSheets } from "@/app/lib/google";
import { sendReviewRequestEmailSMTP } from "@/app/lib/email";
import { isSmsConfigured, sendReviewRequestSMS } from "@/app/lib/sms";

const DEFAULT_GMAPS_REVIEW_URL = "https://g.page/r/CW2mjx_ste2XEBM/review";
const REVIEW_DEDUP_SINCE_ISO = "2026-03-18T00:00:00+02:00";
const REVIEW_SMS_SHEET_TAB = "\u0418\u043c\u0435\u043d\u0430 \u0438 \u0442\u0435\u043b";

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
  for (const m of matches) {
    const phone = normalizeTenDigitPhone(m);
    if (phone) phones.add(phone);
  }
  return [...phones];
}

function extractTenDigitPhoneFromEvent(
  priv: ReviewPrivateProps,
  summary?: string | null,
  description?: string | null
) {
  const directCandidates = [
    priv.customerPhone || "",
    priv.reviewSmsTo || "",
  ];
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
  s = s.replace(/(?:\+359|00359|0)?\s*8\d(?:[\s\-()]*\d){7}/g, "");
  s = s.replace(/\s+[–—-]\s*$/, "");
  s = s.trim().replace(/\s+/g, " ");

  if (!s) return "Неизвестен";
  return s;
}

function formatDirectoryBookedAt(start?: {
  dateTime?: string | null;
  date?: string | null;
}) {
  if (start?.dateTime) {
    const d = new Date(start.dateTime);
    if (!Number.isNaN(d.getTime())) {
      // Sort-friendly format: YYYY-MM-DD HH:mm
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
  return new Date(end.getTime() + 15 * 60 * 1000);
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
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1:D1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["Име", "Телефон", "Кога е записан", "Категория"]],
    },
  });
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

async function syncDirectorySheetFromCalendar(args: {
  calendar: ReturnType<typeof getCalendar>;
  sheets: ReturnType<typeof getSheets>;
  spreadsheetId: string;
  tabName: string;
}) {
  const byPhone = new Map<
    string,
    { name: string; bookedAt: string; sortMs: number; category: string }
  >();

  let pageToken: string | undefined;
  do {
    const res = await args.calendar.events.list({
      calendarId: process.env.BOOKING_CALENDAR_ID!,
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
      const phone = extractTenDigitPhoneFromEvent(
        priv,
        ev.summary,
        ev.description
      );
      if (!phone) continue;

      const name = extractDirectoryName(priv, ev.summary);
      const bookedAt = formatDirectoryBookedAt(ev.start);
      const category = getNameCategoryLetter(name);

      const sortSource = ev.start?.dateTime || ev.start?.date || ev.created || "";
      const sortMs = Number.isNaN(new Date(sortSource).getTime())
        ? Number.MIN_SAFE_INTEGER
        : new Date(sortSource).getTime();

      const prev = byPhone.get(phone);
      // Keep the latest booking by this phone.
      if (!prev || sortMs > prev.sortMs) {
        byPhone.set(phone, { name, bookedAt, sortMs, category });
      }
    }
  } while (pageToken);

  const rows = [...byPhone.entries()]
    .map(([phone, data]) => [data.name, phone, data.bookedAt, data.category, data.sortMs] as const)
    .sort(
      (a, b) =>
        b[4] - a[4] ||
        a[3].localeCompare(b[3], "bg", { sensitivity: "base" }) ||
        a[0].localeCompare(b[0], "bg", { sensitivity: "base" }) ||
        a[1].localeCompare(b[1], "bg", { sensitivity: "base" })
    )
    .map((r) => [r[0], r[1], r[2], r[3]]);

  await args.sheets.spreadsheets.values.clear({
    spreadsheetId: args.spreadsheetId,
    range: `${args.tabName}!A2:D`,
  });

  if (rows.length > 0) {
    await args.sheets.spreadsheets.values.update({
      spreadsheetId: args.spreadsheetId,
      range: `${args.tabName}!A2:D`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
  }

  // Ensure the sheet has filter controls on all directory columns.
  const sheetMeta = await args.sheets.spreadsheets.get({
    spreadsheetId: args.spreadsheetId,
  });
  const targetSheet = (sheetMeta.data.sheets || []).find(
    (s) => s.properties?.title === args.tabName
  );
  const targetSheetId = targetSheet?.properties?.sheetId;
  if (typeof targetSheetId === "number") {
    await args.sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody: {
        requests: [
          {
            setBasicFilter: {
              filter: {
                range: {
                  sheetId: targetSheetId,
                  startRowIndex: 0,
                  endRowIndex: Math.max(rows.length + 1, 2),
                  startColumnIndex: 0,
                  endColumnIndex: 4,
                },
              },
            },
          },
        ],
      },
    });
  }

  return { rowsWritten: rows.length };
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
  const testEmail = parseBool(url.searchParams.get("testEmail"));
  const tabName = process.env.REVIEW_SMS_SHEET_TAB || REVIEW_SMS_SHEET_TAB;
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID || "";

  const calendar = getCalendar();
  const sheets = getSheets();
  const now = new Date();
  const reviewUrl = (process.env.GMAPS_REVIEW_URL || DEFAULT_GMAPS_REVIEW_URL)
    .trim()
    .replace(/^"|"$/g, "");
  const smsReady = false && isSmsConfigured();
  let directoryRowsWritten = 0;

  if (spreadsheetId) {
    await ensureReviewSmsSheet(sheets, spreadsheetId, tabName);
    const syncRes = await syncDirectorySheetFromCalendar({
      calendar,
      sheets,
      spreadsheetId,
      tabName,
    });
    directoryRowsWritten = syncRes.rowsWritten;
  }

  const sentEmails = await collectAlreadySentEmails(calendar, 18);
  const sentPhones = smsReady
    ? await collectAlreadySentPhones(calendar, 18)
    : new Set<string>();
  if (smsReady && spreadsheetId) {
    const sentPhonesFromSheet = await collectAlreadySentPhonesFromSheet(
      sheets,
      spreadsheetId,
      tabName
    );
    for (const phone of sentPhonesFromSheet) sentPhones.add(phone);
  }

  if (testEmail) {
    const testTo = normalizeEmail(url.searchParams.get("testTo") || "");
    const firstName = (
      url.searchParams.get("testName") || "\u0422\u0435\u0441\u0442 \u041a\u043b\u0438\u0435\u043d\u0442"
    ).trim();

    if (!testTo || !testTo.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Invalid testTo email format" },
        { status: 400 }
      );
    }

    if (sentEmails.has(testTo)) {
      return NextResponse.json({
        ok: true,
        mode: "testEmail",
        skipped: true,
        reason: "already-sent-by-email",
        testTo,
      });
    }

    const result = await sendReviewRequestEmailSMTP({
      to: testTo,
      firstName,
      mapReviewUrl: reviewUrl,
    });

    return NextResponse.json({
      ok: true,
      mode: "testEmail",
      testTo,
      messageId: result.messageId || "",
    });
  }

  if (testSms) {
    return NextResponse.json(
      {
        ok: false,
        mode: "testSms",
        error: "SMS is disabled. Phone directory sync is active.",
      },
      { status: 400 }
    );
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
    directoryRowsWritten,
    sentRecipientsEmails: sentEmails.size,
    sentRecipientsPhones: sentPhones.size,
    dedupeSince: REVIEW_DEDUP_SINCE_ISO,
    smsConfigured: smsReady,
    smsDisabled: !smsReady,
    reviewUrl,
    window: { timeMin, timeMax },
  });
}
