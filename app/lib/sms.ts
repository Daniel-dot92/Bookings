type ReviewSmsProps = {
  to: string;
  reviewLink: string;
};

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

export function isReviewSmsConfigured() {
  if (!areReviewSmsNotificationsEnabled()) return false;
  return hasTwilioConfiguration();
}

function hasTwilioConfiguration() {
  const hasAuth =
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN);
  const hasSender =
    Boolean(process.env.TWILIO_FROM) ||
    Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID);

  return Boolean(hasAuth && hasSender);
}

export function areReviewSmsNotificationsEnabled() {
  return (
    (process.env.ENABLE_REVIEW_SMS_NOTIFICATIONS || "").trim().toLowerCase() ===
    "true"
  );
}

async function sendTwilioSms(
  to: string,
  message: string
) {
  if (!areReviewSmsNotificationsEnabled()) {
    throw new Error("Review SMS notifications are disabled.");
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
    `DM Physio: \u0429\u0435 \u0441\u043c\u0435 \u0431\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u043d\u0438 ` +
    `\u0437\u0430 \u043a\u0440\u0430\u0442\u043a\u043e Google \u0440\u0435\u0432\u044e: ${p.reviewLink}`;

  return sendTwilioSms(p.to, message);
}
