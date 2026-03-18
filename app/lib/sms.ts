type ReviewSmsProps = {
  to: string;
  firstName: string;
  mapReviewUrl: string;
};

export function isSmsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM
  );
}

export async function sendReviewRequestSMS(p: ReviewSmsProps) {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = (process.env.TWILIO_FROM || "").trim();

  if (!accountSid || !authToken || !from) {
    throw new Error("Missing Twilio configuration (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM)");
  }

  const firstName = p.firstName.trim() || "клиент";
  const message = `Здравейте, ${firstName}! Ако сте доволни от терапията, оставете ревю: ${p.mapReviewUrl} Благодарим! DM PHYSIO`;

  const body = new URLSearchParams({
    To: p.to,
    From: from,
    Body: message,
  });

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
