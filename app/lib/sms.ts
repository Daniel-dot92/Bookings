type ReviewSmsProps = {
  to: string;
  firstName: string;
  reviewLink: string;
};

type ReminderSmsProps = {
  to: string;
  date: Date;
  therapist: string;
  location: string;
  locationUrl: string;
  kind: "appointment_reminder_24h" | "appointment_reminder_same_day";
};

type ConfirmationSmsProps = {
  to: string;
  date: Date;
  therapist: string;
  location: string;
  locationUrl: string;
};

function formatBgDate(d: Date) {
  return new Intl.DateTimeFormat("bg-BG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Sofia",
  }).format(d);
}

function formatBgTime(d: Date) {
  return new Intl.DateTimeFormat("bg-BG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Sofia",
  }).format(d);
}

export function normalizePhone(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00359") && digits.length === 14) {
    return `+359${digits.slice(5)}`;
  }

  if (digits.startsWith("359") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `+359${digits.slice(1)}`;
  }

  if (digits.length === 9 && digits.startsWith("8")) {
    return `+359${digits}`;
  }

  return "";
}

export function isSmsConfigured() {
  if (!areSmsNotificationsEnabled()) return false;

  const hasAuth =
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN);
  const hasSender =
    Boolean(process.env.TWILIO_FROM) ||
    Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID);

  return Boolean(hasAuth && hasSender);
}

export function areSmsNotificationsEnabled() {
  return (process.env.ENABLE_SMS_NOTIFICATIONS || "").trim().toLowerCase() === "true";
}

async function sendTwilioSms(to: string, message: string) {
  if (!areSmsNotificationsEnabled()) {
    throw new Error("SMS notifications are disabled.");
  }

  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = (process.env.TWILIO_FROM || "").trim();
  const messagingServiceSid = (process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();

  if (!accountSid || !authToken || (!from && !messagingServiceSid)) {
    throw new Error(
      "Missing Twilio configuration (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN and TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID)"
    );
  }

  const body = new URLSearchParams({
    To: to,
    Body: message,
  });
  if (messagingServiceSid) {
    body.set("MessagingServiceSid", messagingServiceSid);
  } else {
    body.set("From", from);
  }

  const token = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Twilio SMS error (${response.status}): ${responseText.slice(0, 250)}`);
  }

  const parsed = JSON.parse(responseText) as { sid?: string };
  return { sid: parsed.sid };
}

export async function sendReviewRequestSMS(p: ReviewSmsProps) {
  const message =
    `DM Physio: \u0410\u043a\u043e \u0441\u0442\u0435 \u0434\u043e\u0432\u043e\u043b\u043d\u0438 \u043e\u0442 \u0442\u0435\u0440\u0430\u043f\u0438\u044f\u0442\u0430 \u0438 \u043e\u0442\u043d\u043e\u0448\u0435\u043d\u0438\u0435\u0442\u043e, ` +
    `\u0449\u0435 \u0441\u043c\u0435 \u0431\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u043d\u0438 \u0437\u0430 \u043a\u0440\u0430\u0442\u043a\u043e Google \u0440\u0435\u0432\u044e: ${p.reviewLink}`;

  return sendTwilioSms(p.to, message);
}

export async function sendAppointmentConfirmationSMS(p: ConfirmationSmsProps) {
  const message =
    `DM Physio: \u041f\u043e\u0442\u0432\u044a\u0440\u0434\u0435\u043d \u0447\u0430\u0441 \u043d\u0430 ${formatBgDate(p.date)} \u0432 ${formatBgTime(p.date)} ` +
    `\u043f\u0440\u0438 ${p.therapist}. \u041e\u0431\u0435\u043a\u0442: ${p.location}. \u041d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f: ${p.locationUrl}`;

  return sendTwilioSms(p.to, message);
}

export async function sendAppointmentReminderSMS(p: ReminderSmsProps) {
  const intro =
    p.kind === "appointment_reminder_same_day"
      ? "DM Physio: \u041d\u0430\u043f\u043e\u043c\u043d\u044f\u043c\u0435 \u0437\u0430 \u0447\u0430\u0441\u0430 \u0432\u0438 \u0434\u043d\u0435\u0441"
      : "DM Physio: \u041d\u0430\u043f\u043e\u043c\u043d\u044f\u043c\u0435 \u0437\u0430 \u0447\u0430\u0441\u0430 \u0432\u0438 \u0443\u0442\u0440\u0435";
  const message =
    `${intro} \u0432 ${formatBgTime(p.date)} \u043f\u0440\u0438 ${p.therapist}. ` +
    `\u041e\u0431\u0435\u043a\u0442: ${p.location}. \u041d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f: ${p.locationUrl}`;

  return sendTwilioSms(p.to, message);
}
