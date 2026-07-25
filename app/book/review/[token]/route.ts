import { NextRequest, NextResponse } from "next/server";
import { getCalendar, getSheets } from "@/app/lib/google";
import { getCalendarIdForOffice } from "@/app/lib/booking-config.server";
import { getReviewLinkForOffice } from "@/app/lib/appointment-communications";
import { getSheetConfigForOffice } from "@/app/lib/sheets-config.server";
import {
  extractReviewName,
  extractReviewPhone,
  getReviewPrivateProps,
} from "@/app/lib/review-policy";
import { markReviewRequestClicked } from "@/app/lib/review-log.server";
import { verifyReviewTrackingToken } from "@/app/lib/review-tracking.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const payload = verifyReviewTrackingToken(token);

  if (!payload) {
    return NextResponse.redirect(new URL("/book", request.nextUrl.origin), 302);
  }

  const reviewLink = getReviewLinkForOffice(payload.officeKey);
  if (!reviewLink) {
    return NextResponse.redirect(new URL("/book", request.nextUrl.origin), 302);
  }

  try {
    const calendarId = getCalendarIdForOffice(payload.officeKey);
    if (!calendarId) throw new Error("Missing calendar for review tracking");

    const calendar = getCalendar();
    const eventResponse = await calendar.events.get({
      calendarId,
      eventId: payload.eventId,
    });
    const event = eventResponse.data;
    const privateProps = getReviewPrivateProps(event);
    const clickedAt = new Date().toISOString();

    await calendar.events.patch({
      calendarId,
      eventId: payload.eventId,
      requestBody: {
        extendedProperties: {
          private: {
            ...privateProps,
            review_link_clicked: "1",
            review_link_clicked_at:
              privateProps.review_link_clicked_at || clickedAt,
            review_visit_number: String(payload.visitNumber),
          },
        },
      },
    });

    const phone = extractReviewPhone(
      privateProps,
      event.summary,
      event.description
    );
    const sheetConfig = getSheetConfigForOffice(payload.officeKey);

    if (phone && sheetConfig.spreadsheetId) {
      const sheets = getSheets();
      await markReviewRequestClicked({
        sheets,
        spreadsheetId: sheetConfig.spreadsheetId,
        tabName: sheetConfig.reviewSentLogTabName,
        clickedAt,
        phone,
        name: extractReviewName(privateProps, event.summary),
        eventId: payload.eventId,
        officeKey: payload.officeKey,
        reviewLink,
        visitNumber: payload.visitNumber,
      });
    }
  } catch (error) {
    console.error("[REVIEW_CLICK] Tracking failed:", error);
  }

  return NextResponse.redirect(reviewLink, 302);
}
