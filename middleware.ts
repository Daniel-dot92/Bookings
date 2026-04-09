import { NextRequest, NextResponse } from "next/server";

const LEGACY_HOSTS = new Set(
  (process.env.LEGACY_BOOKING_HOSTS || "book.dmphysi0.com")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);
const CANONICAL_SITE_URL = "https://www.dmphysi0.com";

function normalizeHost(raw: string) {
  return raw.trim().toLowerCase().replace(/:\d+$/, "");
}

function getCanonicalSiteUrl() {
  const fallback = CANONICAL_SITE_URL;
  const raw = process.env.CANONICAL_SITE_URL || fallback;
  try {
    return new URL(raw);
  } catch {
    return new URL(fallback);
  }
}

export function middleware(req: NextRequest) {
  const host = normalizeHost(req.headers.get("x-forwarded-host") || req.headers.get("host") || "");
  const canonical = getCanonicalSiteUrl();
  if (host === normalizeHost(canonical.host)) return NextResponse.next();
  if (!LEGACY_HOSTS.has(host)) return NextResponse.next();
  if (req.nextUrl.pathname !== "/") return NextResponse.next();

  const destination = new URL(canonical.toString());

  // Redirect only legacy host root. Keep /book served by the booking app.
  destination.pathname = canonical.pathname || "/";
  destination.search = req.nextUrl.search;

  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/", "/book"],
};
