type ReviewSmsProps = {
  to: string;
  firstName: string;
  mapReviewUrl: string;
};

export function isSmsConfigured() {
  const hasAuth =
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN);
  const hasSender =
    Boolean(process.env.TWILIO_FROM) ||
    Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID);

  return Boolean(
    hasAuth && hasSender
  );
}

export async function sendReviewRequestSMS(p: ReviewSmsProps) {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = (process.env.TWILIO_FROM || "").trim();
  const messagingServiceSid = (process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();

  if (!accountSid || !authToken || (!from && !messagingServiceSid)) {
    throw new Error(
      "Missing Twilio configuration (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN and TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID)"
    );
  }

  const firstName =
    p.firstName.trim() || "\u043a\u043b\u0438\u0435\u043d\u0442";
  const message = [
    `\u0417\u0434\u0440\u0430\u0432\u0435\u0439\u0442\u0435, ${firstName}!`,
    "\u0412\u0430\u0448\u0435\u0442\u043e \u043c\u043d\u0435\u043d\u0438\u0435 \u043f\u043e\u043c\u0430\u0433\u0430 \u043d\u0430 \u0434\u0440\u0443\u0433\u0438 \u0445\u043e\u0440\u0430 \u0434\u0430 \u043d\u0430\u043c\u0435\u0440\u044f\u0442 \u043f\u0440\u0430\u0432\u0438\u043b\u043d\u043e\u0442\u043e \u043b\u0435\u0447\u0435\u043d\u0438\u0435.",
    "",
    "\u0429\u0435 \u0441\u0435 \u0440\u0430\u0434\u0432\u0430\u043c\u0435 \u0434\u0430 \u043e\u0441\u0442\u0430\u0432\u0438\u0442\u0435 \u0440\u0435\u0432\u044e \u0442\u0443\u043a:",
    p.mapReviewUrl,
    "",
    "\u0411\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u0438\u043c \u0412\u0438 \u0437\u0430 \u0434\u043e\u0432\u0435\u0440\u0438\u0435\u0442\u043e!",
    "DM PHYSIO",
  ].join("\n");

  const body = new URLSearchParams({
    To: p.to,
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
