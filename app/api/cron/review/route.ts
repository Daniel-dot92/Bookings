import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/google";
import { sendReviewRequestEmailSMTP } from "@/app/lib/email";

type ReviewPrivateProps = Record<string, string> & {
  reviewDueAt?: string;
  reviewEmailSent?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function collectAlreadyEmailedSet(
  calendar: ReturnType<typeof getCalendar>,
  monthsBack = 12
) {
  const now = new Date();
  const past = new Date(now);
  past.setMonth(now.getMonth() - monthsBack);

  const emailed = new Set<string>();
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId: process.env.BOOKING_CALENDAR_ID!,
      timeMin: past.toISOString(),
      timeMax: now.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      pageToken,
    });
    pageToken = res.data.nextPageToken || undefined;

    for (const ev of res.data.items || []) {
      if (ev.status === "cancelled") continue;
      const priv = getPrivateProps(ev);
      const sent = priv.reviewEmailSent === "1";
      const email = priv.customerEmail?.trim().toLowerCase();
      if (sent && email) emailed.add(email);
    }
  } while (pageToken);

  return emailed;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const calendar = getCalendar();
  const now = new Date();

  const alreadyEmailed = await collectAlreadyEmailedSet(calendar, 12);

  const timeMin = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const timeMax = now.toISOString();

  let pageToken: string | undefined;
  let processed = 0;
  let mailed = 0;
  let skippedDuplicate = 0;

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

      const priv = getPrivateProps(ev);
      const reviewDueAtISO = priv.reviewDueAt;
      const reviewEmailSent = priv.reviewEmailSent === "1";
      const customerEmailRaw = priv.customerEmail;
      const firstName = priv.customerFirstName;
      const lastName = priv.customerLastName;

      if (!reviewDueAtISO || !customerEmailRaw || reviewEmailSent) continue;

      const customerEmail = customerEmailRaw.trim().toLowerCase();

      if (alreadyEmailed.has(customerEmail)) {
        skippedDuplicate++;
        await calendar.events.patch({
          calendarId: process.env.BOOKING_CALENDAR_ID!,
          eventId: ev.id!,
          requestBody: {
            extendedProperties: {
              private: {
                ...priv,
                reviewEmailSent: "1",
                reviewEmailSkipReason: "duplicate-email",
              },
            },
          },
        });
        continue;
      }

      const reviewDueAt = new Date(reviewDueAtISO);
      if (now < reviewDueAt) continue;

      const endISO = ev.end?.dateTime || ev.end?.date;
      if (!endISO) continue;
      const end = new Date(endISO);
      if (end > now) continue;

      await sendReviewRequestEmailSMTP({
        to: customerEmail,
        firstName: firstName || "клиент",
        lastName,
        mapReviewUrl: process.env.GMAPS_REVIEW_URL as string,
      });
      mailed++;

      await calendar.events.patch({
        calendarId: process.env.BOOKING_CALENDAR_ID!,
        eventId: ev.id!,
        requestBody: {
          extendedProperties: {
            private: {
              ...priv,
              reviewEmailSent: "1",
              reviewEmailSentAt: new Date().toISOString(),
            },
          },
        },
      });

      alreadyEmailed.add(customerEmail);
    }
  } while (pageToken);

  return NextResponse.json({ ok: true, processed, mailed, skippedDuplicate });
}
