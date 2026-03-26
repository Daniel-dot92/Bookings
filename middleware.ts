import { NextRequest, NextResponse } from "next/server";

const LEGACY_HOSTS = new Set(
  (process.env.LEGACY_BOOKING_HOSTS || "book.dmphysi0.com")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

function normalizeHost(raw: string) {
  return raw.trim().toLowerCase().replace(/:\d+$/, "");
}

function getCanonicalBookingUrl() {
  const fallback = "https://www.dmphysi0.com/book";
  const raw = process.env.NEXT_PUBLIC_BOOKING_URL || process.env.CANONICAL_BOOKING_URL || fallback;
  try {
    return new URL(raw);
  } catch {
    return new URL(fallback);
  }
}

export function middleware(req: NextRequest) {
  const host = normalizeHost(req.headers.get("x-forwarded-host") || req.headers.get("host") || "");
  if (!LEGACY_HOSTS.has(host)) return NextResponse.next();

  const canonical = getCanonicalBookingUrl();
  const destination = new URL(canonical.toString());

  // Keep explicit /book route; root resolves to canonical booking path.
  destination.pathname = req.nextUrl.pathname === "/" ? canonical.pathname : req.nextUrl.pathname;
  destination.search = req.nextUrl.search;

  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/", "/book"],
};

