const DEFAULT_SITE_URL = "https://www.dmphysi0.com";
const DEFAULT_BOOKING_PATH = "/book";

function normalizeAbsoluteUrl(raw: string, fallback: string): string {
  const candidate = raw.trim();
  try {
    return new URL(candidate).toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  return normalizeAbsoluteUrl(envUrl || DEFAULT_SITE_URL, DEFAULT_SITE_URL);
}

export function getBookingUrl(): string {
  const explicitBookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL;
  const fallback = `${getSiteUrl()}${DEFAULT_BOOKING_PATH}`;
  if (explicitBookingUrl) return normalizeAbsoluteUrl(explicitBookingUrl, fallback);
  return fallback;
}
