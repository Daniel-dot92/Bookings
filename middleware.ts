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

function getCanonicalSiteUrl() {
  const fallback = "https://www.dmphysi0.com";
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.CANONICAL_SITE_URL || fallback;
  try {
    return new URL(raw);
  } catch {
    return new URL(fallback);
  }
}

export function middleware(req: NextRequest) {
  const host = normalizeHost(req.headers.get("x-forwarded-host") || req.headers.get("host") || "");
  if (!LEGACY_HOSTS.has(host)) return NextResponse.next();

  const canonical = getCanonicalSiteUrl();
  const destination = new URL(canonical.toString());

  // Redirect legacy booking host to canonical site root (avoids /book loops on main domain).
  destination.pathname = canonical.pathname || "/";
  destination.search = req.nextUrl.search;

  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/", "/book"],
};
