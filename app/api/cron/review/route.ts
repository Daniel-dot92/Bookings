import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { sendReviewRequestEmailSMTP } from "@/app/lib/email";

const DEFAULT_GMAPS_REVIEW_URL = "https://g.page/r/CW2mjx_ste2XEBM/review";
const REVIEW_DEDUP_SINCE_ISO = "2026-03-18T00:00:00+02:00";

type ReviewPrivateProps = Record<string, string> & {
  reviewDueAt?: string;
  reviewEmailSent?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
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

function extractEmailFromDescription(description?: string | null) {
  if (!description) return "";
  const match = description.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function hasFifthProcedureMarker(firstName: string, summary?: string | null) {
  const text = `${firstName || ""} ${summary || ""}`;
  return /(^|[\s,;:()])\S*-5($|[\s,;:()])/u.test(text);
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
  return firstToken.replace(/-5$/u, "").trim();
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

      const email = normalizeEmail(priv.customerEmail || extractEmailFromDescription(ev.description));
      if (email) sentEmails.add(email);
    }
  } while (pageToken);

  return sentEmails;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = parseBool(url.searchParams.get("dryRun"));

  const calendar = getCalendar();
  const now = new Date();
  const reviewUrl = DEFAULT_GMAPS_REVIEW_URL;

  const sentEmails = await collectAlreadySentEmails(calendar, 18);

  // Look back 7 days so temporary cron outages do not miss review emails.
  const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = now.toISOString();

  let pageToken: string | undefined;
  let processed = 0;
  let eligible = 0;
  let mailed = 0;
  let failed = 0;
  let skippedMissingData = 0;
  let skippedNotDue = 0;
  let skippedAlreadySentByEmail = 0;
  let skippedNotMatchingRules = 0;
  let eligibleByWebsiteBooking = 0;
  let eligibleByFifthMarker = 0;

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
      const reviewEmailSent = priv.reviewEmailSent === "1";
      const firstName = deriveFirstName(priv.customerFirstName || "", ev.summary);
      const lastName = (priv.customerLastName || "").trim();
      const matchedWebsiteRule = isWebsiteBooking(priv, ev.description);
      const matchedFifthRule = hasFifthProcedureMarker(firstName, ev.summary);

      if (reviewEmailSent) continue;

      if (!matchedWebsiteRule && !matchedFifthRule) {
        skippedNotMatchingRules++;
        continue;
      }

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

      const customerEmail = normalizeEmail(priv.customerEmail || extractEmailFromDescription(ev.description));
      if (!customerEmail) {
        skippedMissingData++;
        continue;
      }

      const reviewTrigger = matchedWebsiteRule
        ? matchedFifthRule
          ? "website-and-fifth-marker"
          : "website-booking"
        : "fifth-marker";

      if (matchedWebsiteRule) {
        eligibleByWebsiteBooking++;
      } else {
        eligibleByFifthMarker++;
      }

      if (sentEmails.has(customerEmail)) {
        skippedAlreadySentByEmail++;

        if (!dryRun) {
          await calendar.events.patch({
            calendarId: process.env.BOOKING_CALENDAR_ID!,
            eventId: ev.id,
            requestBody: {
              extendedProperties: {
                private: {
                  ...priv,
                  reviewEmailSent: "1",
                  reviewEmailSkippedAt: new Date().toISOString(),
                  reviewEmailSkipReason: "already-sent-by-email",
                  reviewTrigger,
                  reviewDueAt: reviewDueAt.toISOString(),
                  customerEmail,
                },
              },
            },
          });
        }

        continue;
      }

      eligible++;
      if (dryRun) continue;

      try {
        await sendReviewRequestEmailSMTP({
          to: customerEmail,
          firstName: firstName || "клиент",
          lastName,
          mapReviewUrl: reviewUrl,
        });
        mailed++;

        await calendar.events.patch({
          calendarId: process.env.BOOKING_CALENDAR_ID!,
          eventId: ev.id,
          requestBody: {
            extendedProperties: {
              private: {
                ...priv,
                customerEmail,
                reviewTrigger,
                reviewDueAt: reviewDueAt.toISOString(),
                reviewEmailSent: "1",
                reviewEmailSentAt: new Date().toISOString(),
                reviewEmailError: "",
              },
            },
          },
        });

        sentEmails.add(customerEmail);
      } catch (err: unknown) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        await calendar.events.patch({
          calendarId: process.env.BOOKING_CALENDAR_ID!,
          eventId: ev.id,
          requestBody: {
            extendedProperties: {
              private: {
                ...priv,
                customerEmail,
                reviewTrigger,
                reviewDueAt: reviewDueAt.toISOString(),
                reviewEmailLastAttemptAt: new Date().toISOString(),
                reviewEmailError: message.slice(0, 250),
              },
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
    eligible,
    mailed,
    failed,
    skippedMissingData,
    skippedNotDue,
    skippedAlreadySentByEmail,
    skippedNotMatchingRules,
    eligibleByWebsiteBooking,
    eligibleByFifthMarker,
    sentRecipientsEmails: sentEmails.size,
    dedupeSince: REVIEW_DEDUP_SINCE_ISO,
    reviewUrl,
    window: { timeMin, timeMax },
  });
}
