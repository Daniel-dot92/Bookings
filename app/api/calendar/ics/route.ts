import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDefaultIcsLocation() {
  return (process.env.DM_PHYSIO_ADDRESS || "").trim() || "DM PHYSIO, Sofia";
}

function toUtcZ(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid datetime");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeICS(s: string) {
  return s.replace(/([\\;,])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

function safeText(value: string | null, fallback: string, maxLen = 300) {
  const v = (value || fallback).trim();
  return v.slice(0, maxLen);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const title = safeText(searchParams.get("title"), "DM PHYSIO booking", 120);
  const start = searchParams.get("start") || "";
  const end = searchParams.get("end") || "";
  const location = safeText(
    searchParams.get("location"),
    getDefaultIcsLocation(),
    180
  );
  const details = safeText(
    searchParams.get("details"),
    "Потвърден час в DM PHYSIO.",
    2000
  );

  if (!start || !end) {
    return NextResponse.json(
      { ok: false, error: "Missing start/end query params." },
      { status: 400 }
    );
  }

  let dtStart = "";
  let dtEnd = "";
  try {
    dtStart = toUtcZ(start);
    dtEnd = toUtcZ(end);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid start/end datetime." },
      { status: 400 }
    );
  }

  const dtStamp = toUtcZ(new Date().toISOString());
  const uid = `dmphysio-${Date.now()}-${Math.random().toString(36).slice(2)}@dmphysio.com`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DM PHYSIO//Booking//BG",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(title)}`,
    `DESCRIPTION:${escapeICS(details)}`,
    `LOCATION:${escapeICS(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dmphysio-booking.ics"',
      "Cache-Control": "no-store",
    },
  });
}
