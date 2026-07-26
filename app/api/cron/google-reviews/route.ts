import { NextRequest, NextResponse } from "next/server";
import { refreshGoogleReviewStats } from "@/app/lib/google-review-stats.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(process.env.GOOGLE_PLACES_API_KEY || "").trim()) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const reviews = await refreshGoogleReviewStats();
  const updated = Object.values(reviews).filter(Boolean).length;

  return NextResponse.json({
    ok: updated === 2,
    updated,
    reviews,
  });
}
