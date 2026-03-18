// /app/lib/email.ts
import * as nodemailer from "nodemailer";

// ===============================
// РўРёРїРѕРІРµ Р·Р° РёРјРµР№Р»Р° Рё .ics С„Р°Р№Р»Р°
// ===============================
export type BookingEmailProps = {
  to: string;           // РїРѕР»СѓС‡Р°С‚РµР»
  from: string;         // "РѕС‚" Р·Р° РєР»РёРµРЅС‚Р° (С‰Рµ РёРґРµ РІ replyTo/Р±СЂРµРЅРґ)
  subject: string;      // С‚РµРјР° РЅР° РёРјРµР№Р»Р°
  firstName: string;
  lastName: string;
  dateText: string;     // РЅР°РїСЂ. "СЃСЉР±РѕС‚Р°, 25 РѕРєС‚РѕРјРІСЂРё 2025 Рі."
  timeText: string;     // РЅР°РїСЂ. "13:00вЂ“14:00 (60 РјРёРЅ)"
  therapist?: string;   // РёРјРµ РЅР° С‚РµСЂР°РїРµРІС‚Р° (РѕРїС†.)
  procedure: string;    // СѓСЃР»СѓРіР°/РїСЂРѕС†РµРґСѓСЂР°
  phone: string;        // С‚РµР»РµС„РѕРЅ РЅР° РєР»РёРµРЅС‚Р°
  address?: string;     // РїРѕ РїРѕРґСЂР°Р·Р±РёСЂР°РЅРµ: РЎРѕС„РёСЏ, СѓР». РџСЂРѕС„. РҐСЂРёСЃС‚Рѕ Р”Р°РЅРѕРІ 19
  notes?: string;       // СЃРёРјРїС‚РѕРјРё/Р±РµР»РµР¶РєРё (РѕРїС†.)
  eventUid?: string;    // UID Р·Р° .ics (РѕРїС†.)
  startISO: string;     // Р»РѕРєР°Р»РЅРѕ ISO СЃ offset, РЅР°РїСЂ. 2025-10-27T13:00:00+03:00
  endISO: string;       // Р»РѕРєР°Р»РЅРѕ ISO СЃ offset
  tzid?: string;        // РЅР°РїСЂ. "Europe/Sofia" (РёРЅС„РѕСЂРјР°С‚РёРІРЅРѕ)
  extraHtml?: string;   // РґРѕРїСЉР»РЅРёС‚РµР»РµРЅ HTML (Р±СѓС‚РѕРЅ Р·Р° РЅР°РІРёРіР°С†РёСЏ Рё РґСЂ.)
};

// ===============================
// РџРѕРјРѕС‰РЅРё С„СѓРЅРєС†РёРё
// ===============================
/** РњРёРЅРё РµСЃРєРµР№Рї Р·Р° HTML С‚РµРєСЃС‚РѕРІРё РїРѕР»РµС‚Р° */
function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** HTML С€Р°Р±Р»РѕРЅ РЅР° РёРјРµР№Р»Р° */
function buildEmailHTML(p: BookingEmailProps) {
  const address = p.address ?? "РЎРѕС„РёСЏ, СѓР». РџСЂРѕС„. РҐСЂРёСЃС‚Рѕ Р”Р°РЅРѕРІ 19";

  const therapistLine = p.therapist
    ? `<p style="margin:0"><strong>РўРµСЂР°РїРµРІС‚:</strong> ${esc(p.therapist)}</p>`
    : "";
  const notesLine = p.notes
    ? `<p style="margin:0"><strong>РЎРёРјРїС‚РѕРјРё/Р±РµР»РµР¶РєРё:</strong> ${esc(p.notes)}</p>`
    : "";

  const extraHtml = p.extraHtml ? `<div style="margin-top:12px">${p.extraHtml}</div>` : "";

  return `<!doctype html>
<html>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
               color:#0f172a;background-color:#ffffff;margin:0;padding:20px;">
    <div style="max-width:600px;margin:auto;">
      <h2 style="margin:0 0 8px 0;color:#111827;">РџРѕС‚РІСЉСЂР¶РґРµРЅРёРµ Р·Р° С‡Р°СЃ</h2>
      <p style="margin:0 0 16px 0;">Р—РґСЂР°РІРµР№С‚Рµ, ${esc(p.firstName)} ${esc(p.lastName)},</p>
      <p style="margin:0 0 8px 0;">Р’Р°С€РёСЏС‚ С‡Р°СЃ Р±РµС€Рµ СѓСЃРїРµС€РЅРѕ Р·Р°РїР°Р·РµРЅ.</p>

      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;background:#f8fafc;">
        <p style="margin:0"><strong>Р”Р°С‚Р°:</strong> ${esc(p.dateText)}</p>
        <p style="margin:0"><strong>Р§Р°СЃ:</strong> ${esc(p.timeText)}</p>
        ${therapistLine}
        <p style="margin:0"><strong>РџСЂРѕС†РµРґСѓСЂР°:</strong> ${esc(p.procedure)}</p>
        <p style="margin:0"><strong>РўРµР»РµС„РѕРЅ Р·Р° РІСЂСЉР·РєР°:</strong> ${esc(p.phone)}</p>
        <p style="margin:0"><strong>РђРґСЂРµСЃ:</strong> ${esc(address)}</p>
        ${notesLine}
        ${extraHtml}
      </div>

      <p style="margin:12px 0;font-size:15px;">
        РђРєРѕ РЅРµС‰Рѕ СЃРµ РїСЂРѕРјРµРЅРё, РѕР±Р°РґРµС‚Рµ СЃРµ РЅР° 
        <a href="tel:0883688414" style="color:#0284c7;text-decoration:none;font-weight:600;">
          0883 688 414
        </a>.
      </p>

      <p style="margin:0;color:#334155;">РџРѕР·РґСЂР°РІРё,<br/><strong>DM PHYSIO</strong></p>
    </div>
  </body>
</html>`;
}

/** .ics РіРµРЅРµСЂР°С‚РѕСЂ (iCalendar) */
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

  const title = `РџСЂРѕС†РµРґСѓСЂР°: ${p.procedure}${p.therapist ? " вЂў " + p.therapist : ""}`;
  const descriptionLines = [
    "РџРѕС‚РІСЉСЂРґРµРЅ С‡Р°СЃ РІ DM PHYSIO.",
    `РљР»РёРµРЅС‚: ${p.firstName} ${p.lastName}`,
    `РўРµР»РµС„РѕРЅ: ${p.phone}`,
    p.notes ? `Р‘РµР»РµР¶РєРё: ${p.notes}` : null,
  ].filter(Boolean) as string[];

  const description = descriptionLines.join("\n");
  const location = p.address ?? "РЎРѕС„РёСЏ, СѓР». РџСЂРѕС„. РҐСЂРёСЃС‚Рѕ Р”Р°РЅРѕРІ 19";

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
// РР·РїСЂР°С‰Р°РЅРµ РїСЂРµР· Gmail SMTP (Nodemailer)
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
// ========= Имейл за ревю след посещение =========
export async function sendReviewRequestEmailSMTP(p: {
  to: string;
  firstName: string;
  lastName?: string;
  mapReviewUrl: string;
}) {
  const env = process.env as Record<string, string | undefined>;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("Missing SMTP_* environment variables");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    logger: true,
    debug: true,
  });
  await transporter.verify();

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const fullName = `${esc(p.firstName)}${p.lastName ? " " + esc(p.lastName) : ""}`;

  const html = `<!doctype html>
<html>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#fff;margin:0;padding:20px">
  <div style="max-width:600px;margin:auto">
    <p style="margin:0 0 14px 0;">Здравейте, ${fullName},</p>

    <h2 style="margin:0 0 10px 0;color:#111827;font-size:22px;line-height:1.3;">Как се чувствате след терапията?</h2>

    <p style="margin:0 0 10px 0;">По-леко движение? По-малко болка? Или най-накрая усещате, че тялото ви започва да работи както трябва?</p>

    <p style="margin:0 0 10px 0;">За нас това означава много.</p>

    <p style="margin:0 0 10px 0;">Ако сме ви помогнали дори малко да се освободите от болката и да се върнете към нормалния си живот, ще сме ви благодарни да споделите своя опит.</p>

    <p style="margin:0 0 10px 0;">Вашето мнение помага на други хора, които в момента се колебаят и живеят с болка, да направят първата стъпка към промяната.</p>

    <div style="margin:18px 0">
      <a href="${esc(p.mapReviewUrl)}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600">👉 Оставете ревю в Google</a>
    </div>

    <p style="margin:0 0 8px 0;">Благодарим ви, че ни се доверихте!</p>

    <p style="margin:0;color:#334155;">С уважение,<br><strong>DM PHYSIO</strong></p>
    <p style="margin:12px 0 0 0;color:#334155;">
      Даниел Митев - Телефон<br>
      0883 688 414<br>
      Елица Колева -телефон 0893 673 007
    </p>
  </div>
</body>
</html>`;

  const fromHeader = SMTP_USER!;
  const replyToHeader =
    EMAIL_FROM && EMAIL_FROM.includes("@") ? EMAIL_FROM : SMTP_USER!;

  const info = await transporter.sendMail({
    from: fromHeader,
    sender: SMTP_USER,
    replyTo: replyToHeader,
    to: p.to,
    subject: "Как се чувствате след терапията?",
    html,
  });

  return { messageId: info?.messageId as string | undefined };
}
