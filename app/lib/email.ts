// /app/lib/email.ts
import * as nodemailer from "nodemailer";

// ===============================
// Типове за имейла и .ics файла
// ===============================
export type BookingEmailProps = {
  to: string;           // получател
  from: string;         // "от" за клиента (ще иде в replyTo/бренд)
  subject: string;      // тема на имейла
  firstName: string;
  lastName: string;
  dateText: string;     // напр. "събота, 25 октомври 2025 г."
  timeText: string;     // напр. "13:00–14:00 (60 мин)"
  therapist?: string;   // име на терапевта (опц.)
  procedure: string;    // услуга/процедура
  phone: string;        // телефон на клиента
  address?: string;     // по подразбиране: София, ул. Проф. Христо Данов 19
  notes?: string;       // симптоми/бележки (опц.)
  eventUid?: string;    // UID за .ics (опц.)
  startISO: string;     // локално ISO с offset, напр. 2025-10-27T13:00:00+03:00
  endISO: string;       // локално ISO с offset
  tzid?: string;        // напр. "Europe/Sofia" (информативно)
  extraHtml?: string;   // допълнителен HTML (бутон за навигация и др.)
};

// ===============================
// Помощни функции
// ===============================
/** Мини ескейп за HTML текстови полета */
function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** HTML шаблон на имейла */
function buildEmailHTML(p: BookingEmailProps) {
  const address = p.address ?? "София, ул. Проф. Христо Данов 19";

  const therapistLine = p.therapist
    ? `<p style="margin:0"><strong>Терапевт:</strong> ${esc(p.therapist)}</p>`
    : "";
  const notesLine = p.notes
    ? `<p style="margin:0"><strong>Симптоми/бележки:</strong> ${esc(p.notes)}</p>`
    : "";

  const extraHtml = p.extraHtml ? `<div style="margin-top:12px">${p.extraHtml}</div>` : "";

  return `<!doctype html>
<html>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
               color:#0f172a;background-color:#ffffff;margin:0;padding:20px;">
    <div style="max-width:600px;margin:auto;">
      <h2 style="margin:0 0 8px 0;color:#111827;">Потвърждение за час</h2>
      <p style="margin:0 0 16px 0;">Здравейте, ${esc(p.firstName)} ${esc(p.lastName)},</p>
      <p style="margin:0 0 8px 0;">Вашият час беше успешно запазен.</p>

      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;background:#f8fafc;">
        <p style="margin:0"><strong>Дата:</strong> ${esc(p.dateText)}</p>
        <p style="margin:0"><strong>Час:</strong> ${esc(p.timeText)}</p>
        ${therapistLine}
        <p style="margin:0"><strong>Процедура:</strong> ${esc(p.procedure)}</p>
        <p style="margin:0"><strong>Телефон за връзка:</strong> ${esc(p.phone)}</p>
        <p style="margin:0"><strong>Адрес:</strong> ${esc(address)}</p>
        ${notesLine}
        ${extraHtml}
      </div>

      <p style="margin:12px 0;font-size:15px;">
        Ако нещо се промени, обадете се на 
        <a href="tel:0883688414" style="color:#0284c7;text-decoration:none;font-weight:600;">
          0883 688 414
        </a>.
      </p>

      <p style="margin:0;color:#334155;">Поздрави,<br/><strong>DM PHYSIO</strong></p>
    </div>
  </body>
</html>`;
}

/** .ics генератор (iCalendar) */
function buildICS(p: BookingEmailProps) {
  const uid = p.eventUid ?? `${Date.now()}@dmphysio.com`;

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
  const descriptionLines = [
    "Потвърден час в DM PHYSIO.",
    `Клиент: ${p.firstName} ${p.lastName}`,
    `Телефон: ${p.phone}`,
    p.notes ? `Бележки: ${p.notes}` : null,
  ].filter(Boolean) as string[];

  const description = descriptionLines.join("\n");
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

// =========================================
// Изпращане през Gmail SMTP (Nodemailer)
// =========================================
export async function sendBookingEmailSMTP(p: BookingEmailProps) {
  const env = process.env as Record<string, string | undefined>;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("Missing SMTP_* environment variables");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    logger: true,
    debug: true,
  });

  await transporter.verify();

  const html = buildEmailHTML(p);
  const ics = buildICS(p);

  const fromHeader = SMTP_USER!;
  const replyToHeader =
    EMAIL_FROM && EMAIL_FROM.includes("@")
      ? EMAIL_FROM
      : p.from && p.from.includes("@")
      ? p.from
      : SMTP_USER!;

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
