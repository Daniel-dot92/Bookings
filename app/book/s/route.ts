import { NextResponse } from "next/server";
import { getReviewLinkForOffice } from "@/app/lib/appointment-communications";

export function GET() {
  const reviewLink = getReviewLinkForOffice("studentski-grad");
  return NextResponse.redirect(reviewLink || "/book/hristo-danov", 302);
}
