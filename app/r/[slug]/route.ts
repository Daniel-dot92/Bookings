import { NextRequest, NextResponse } from "next/server";
import { getOfficeDefinition } from "@/app/lib/booking-config";
import { getReviewLinkForOffice } from "@/app/lib/appointment-communications";

const QR_TARGETS: Record<string, { path: string; content: string }> = {
  "hristo-danov-door": {
    path: "/book/hristo-danov",
    content: "hristo-danov",
  },
  "mladost-door": {
    path: "/book/mladost",
    content: "mladost",
  },
  "map-studentski": {
    path: getOfficeDefinition("studentski-grad").mapsUrl,
    content: "map-studentski",
  },
  "map-mladost": {
    path: getOfficeDefinition("mladost-1a").mapsUrl,
    content: "map-mladost",
  },
  "review-studentski": {
    path: getReviewLinkForOffice("studentski-grad") || "/book/hristo-danov",
    content: "review-studentski",
  },
  "review-mladost": {
    path: getReviewLinkForOffice("mladost-1a") || "/book/mladost",
    content: "review-mladost",
  },
};

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const target = QR_TARGETS[slug];

  if (!target) {
    return NextResponse.redirect(new URL("/book", request.nextUrl.origin), 302);
  }

  if (target.path.startsWith("http://") || target.path.startsWith("https://")) {
    return NextResponse.redirect(target.path, 302);
  }

  const url = new URL(target.path, request.nextUrl.origin);
  url.searchParams.set("utm_source", "qr");
  url.searchParams.set("utm_medium", "offline");
  url.searchParams.set("utm_campaign", "door");
  url.searchParams.set("utm_content", target.content);

  return NextResponse.redirect(url, 302);
}
