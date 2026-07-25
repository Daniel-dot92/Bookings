import { NextResponse } from "next/server";
import { getReviewLinkForOffice } from "@/app/lib/appointment-communications";

export function GET() {
  const reviewLink = getReviewLinkForOffice("mladost-1a");
  return NextResponse.redirect(reviewLink || "/book/mladost", 302);
}
