// app/lib/google.ts
import { google } from "googleapis";

/**
 * OAuth2 клиент (ползва се само от /api/oauth/*,
 * не е нужен за Service Account в продъкшън, но го оставяме за съвместимост)
 */
export function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  }
  return client;
}

/**
 * Service Account auth – декодира base64 JSON и връща JWT auth
 */
function getServiceAccountAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!b64) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
  const jsonStr = Buffer.from(b64, "base64").toString("utf8");
  const creds = JSON.parse(jsonStr);

  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

/**
 * Връща Calendar API клиент с правилния auth (SA или OAuth2)
 */
export function getCalendar() {
  const useSA = String(process.env.USE_SERVICE_ACCOUNT).toLowerCase() === "true";
  const auth = useSA ? getServiceAccountAuth() : getOAuth2Client();
  return google.calendar({ version: "v3", auth });
}
