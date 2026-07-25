import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import type { OfficeKey } from "@/app/lib/booking-config";

type ReviewTrackingPayload = {
  version: 1;
  officeKey: OfficeKey;
  eventId: string;
  visitNumber: number;
};

function getTrackingSecret() {
  const secret =
    (process.env.REVIEW_TRACKING_SECRET || "").trim() ||
    (process.env.CRON_SECRET || "").trim();

  if (!secret) {
    throw new Error("Missing REVIEW_TRACKING_SECRET or CRON_SECRET");
  }

  return secret;
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getTrackingSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function signCompactPayload(encodedPayload: string) {
  return createHmac("sha256", getTrackingSecret())
    .update(`2.${encodedPayload}`)
    .digest()
    .subarray(0, 12)
    .toString("base64url");
}

export function createReviewTrackingToken(
  payload: Omit<ReviewTrackingPayload, "version">
) {
  const officeCode = payload.officeKey === "studentski-grad" ? "s" : "m";
  const encodedPayload = Buffer.from(
    `${officeCode}|${payload.visitNumber.toString(36)}|${payload.eventId}`,
    "utf8"
  ).toString("base64url");
  const signature = signCompactPayload(encodedPayload);

  return `2.${encodedPayload}.${signature}`;
}

export function verifyReviewTrackingToken(token: string) {
  const compactParts = token.split(".");
  if (compactParts.length === 3 && compactParts[0] === "2") {
    const [, encodedPayload, suppliedSignature] = compactParts;
    if (!encodedPayload || !suppliedSignature) return null;

    const expectedSignature = signCompactPayload(encodedPayload);
    const supplied = Buffer.from(suppliedSignature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return null;
    }

    try {
      const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
      const [officeCode, visitNumberBase36, eventId, ...rest] = decoded.split("|");
      const officeKey =
        officeCode === "s"
          ? "studentski-grad"
          : officeCode === "m"
            ? "mladost-1a"
            : null;
      const visitNumber = Number.parseInt(visitNumberBase36 || "", 36);

      if (
        !officeKey ||
        rest.length > 0 ||
        !eventId ||
        !Number.isInteger(visitNumber) ||
        visitNumber <= 0
      ) {
        return null;
      }

      return {
        version: 1,
        officeKey,
        eventId,
        visitNumber,
      } satisfies ReviewTrackingPayload;
    } catch {
      return null;
    }
  }

  const [encodedPayload, suppliedSignature, ...rest] = token.split(".");
  if (!encodedPayload || !suppliedSignature || rest.length > 0) return null;

  const expectedSignature = signPayload(encodedPayload);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<ReviewTrackingPayload>;

    if (
      payload.version !== 1 ||
      (payload.officeKey !== "studentski-grad" &&
        payload.officeKey !== "mladost-1a") ||
      typeof payload.eventId !== "string" ||
      !payload.eventId ||
      !Number.isInteger(payload.visitNumber) ||
      Number(payload.visitNumber) <= 0
    ) {
      return null;
    }

    return payload as ReviewTrackingPayload;
  } catch {
    return null;
  }
}
