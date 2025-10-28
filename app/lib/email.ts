// /app/lib/email.ts

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// @ts-ignore – разрешаваме CJS require през ESM
const nodemailer = require("nodemailer") as typeof import("nodemailer");

// Данни за имейла и .ics
export type BookingEmailProps = {
  to: string;
  from: string;
  subject: string;
  firstName: string;
  lastName: string;
  dateText: string;   // напр. "събота, 25 октомври 2025 г."
  timeText: string;   // напр. "13:00–14:00 (60 мин)"
  therapist?: string;
  procedure: string;
  phone: string;
  address?: string;   // по подразбиране: София, ул. Проф. Христо Данов 19
  notes?: string;     // симптоми (optional)
  eventUid?: string;  // за .ics UID
  startISO: string;   // локално ISO с offset (напр. 2025-10-27T13:00:00+03:00)
  endISO: string;     // локално ISO с offset
  tzid?: string;      // напр. "Europe/Sofia"
};

/** Мини ескейп за HTML текстови полета */
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** HTML имейл като низ – без React/JSX */
function buildEmailHTML(p: BookingEmailProps) {
  const address = p.address ?? "София, ул. Проф. Христо Данов 19";
  const therapistLine = p.therapist
    ? `<p style="margin:0"><strong>Терапевт:</strong> ${esc(p.therapist)}</p>`
    : "";
  const notesLine = p.notes
    ? `<p style="margin:0"><strong>Симптоми/бележки:</strong> ${esc(p.notes)}</p>`
    : "";

  return `<!doctype html>
<html>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
    <h2 style="margin:0 0 8px 0">Потвърждение за час</h2>
    <p style="margin:0 0 16px 0">Здравей, ${esc(p.firstName)} ${esc(p.lastName)},</p>
    <p style="margin:0 0 8px 0">Запазихме твоя час успешно.</p>

    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin:12px 0;background:#f8fafc">
      <p style="margin:0"><strong>Дата:</strong> ${esc(p.dateText)}</p>
      <p style="margin:0"><strong>Час:</strong> ${esc(p.timeText)}</p>
      ${therapistLine}
      <p style="margin:0"><strong>Процедура:</strong> ${esc(p.procedure)}</p>
      <p style="margin:0"><strong>Телефон за връзка:</strong> ${esc(p.phone)}</p>
      <p style="margin:0"><strong>Адрес:</strong> ${esc(address)}</p>
      ${notesLine}
    </div>

    <p style="margin:12px 0">
      Ако нещо се промени, обадете се на <a href="tel:0883688414">0883 688 414</a>.
    </p>
    <p style="margin:0">Поздрави,<br/>DM PHYSIO</p>
  </body>
</html>`;
}

/** .ics генератор (iCalendar) */
function buildICS(p: BookingEmailProps) {
  const uid = p.eventUid ?? `${Date.now()}@dmphysi0.com`;

  // Конвертираме към UTC формат YYYYMMDDTHHMMSSZ
  const toUtcZ = (iso: string) => {
    const d = new Date(iso);
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
  };

  const dtStamp = toUtcZ(new Date().toISOString());
  const dtStart = toUtcZ(p.startISO);
  const dtEnd = toUtcZ(p.endISO);

  const title = `Процедура: ${p.procedure}${p.therapist ? " • " + p.therapist : ""}`;
  const description = `Потвърден час в DM PHYSIO.\nКлиент: ${p.firstName} ${p.lastName}\nТелефон: ${p.phone}`;
  const location = p.address ?? "София, ул. Проф. Христо Данов 19";

  const escapeICS = (s: string) =>
    s.replace(/([\\;,])/g, "\\$1").replace(/\r?\n/g, "\\n");

  return [
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
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Изпращане през Nodemailer (Gmail SMTP) с verify и debug */
export async function sendBookingEmailSMTP(p: BookingEmailProps) {
  const env = process.env as Record<string, string | undefined>;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("Missing SMTP_* env vars");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // Gmail: 465 true, 587 false
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    logger: true,
    debug: true,
  });

  await transporter.verify();

  const html = buildEmailHTML(p);
  const ics = buildICS(p);

  // За Gmail – изпращаме "from" от самия акаунт; брандовото име – в replyTo
  const fromHeader = SMTP_USER!;
  const replyToHeader =
    EMAIL_FROM && EMAIL_FROM.includes("@") ? EMAIL_FROM : SMTP_USER!;

  const info = await transporter.sendMail({
    from: fromHeader,
    sender: SMTP_USER,
    replyTo: replyToHeader,
    to: p.to,
    subject: p.subject,
    html,
    attachments: [
      {
        filename: "dmphysio-booking.ics",
        content: ics,
        contentType: "text/calendar; charset=utf-8",
      },
    ],
  });

  return { messageId: info?.messageId as string | undefined };
}
