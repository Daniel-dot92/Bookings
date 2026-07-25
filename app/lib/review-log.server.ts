import { getSheets } from "@/app/lib/google";
import { normalizePhone } from "@/app/lib/sms";
import {
  REVIEW_SENT_LOG_HEADERS,
  ensureSheetWithHeaders,
} from "@/app/lib/sheets-config.server";
import { buildReviewMilestoneKey } from "@/app/lib/review-policy";

type SheetsClient = ReturnType<typeof getSheets>;

export type ReviewHistory = {
  legacyBlockedPhones: Set<string>;
  clickedPhones: Set<string>;
  sentMilestones: Set<string>;
  sentEventIds: Set<string>;
};

export async function readReviewHistory(args: {
  sheets: SheetsClient;
  spreadsheetId: string;
  tabName: string;
  ensureSheet?: boolean;
}) {
  if (args.ensureSheet !== false) {
    await ensureSheetWithHeaders(
      args.sheets,
      args.spreadsheetId,
      args.tabName,
      REVIEW_SENT_LOG_HEADERS
    );
  }

  const history: ReviewHistory = {
    legacyBlockedPhones: new Set<string>(),
    clickedPhones: new Set<string>(),
    sentMilestones: new Set<string>(),
    sentEventIds: new Set<string>(),
  };

  try {
    const response = await args.sheets.spreadsheets.values.get({
      spreadsheetId: args.spreadsheetId,
      range: `${args.tabName}!A2:I`,
    });

    for (const row of response.data.values || []) {
      const phone = normalizePhone(String(row[1] || ""));
      const eventId = String(row[3] || "").trim();
      const visitNumber = Number(String(row[6] || "").trim());
      const clickedAt = String(row[8] || "").trim();

      if (eventId) history.sentEventIds.add(eventId);
      if (!phone) continue;

      if (clickedAt) history.clickedPhones.add(phone);
      if (Number.isInteger(visitNumber) && visitNumber > 0) {
        history.sentMilestones.add(
          buildReviewMilestoneKey(phone, visitNumber)
        );
      } else {
        history.legacyBlockedPhones.add(phone);
      }
    }
  } catch {
    // The sheet can be newly created and empty.
  }

  return history;
}

export async function appendReviewRequestLog(args: {
  sheets: SheetsClient;
  spreadsheetId: string;
  tabName: string;
  sentAt: string;
  phone: string;
  name: string;
  eventId: string;
  officeKey: string;
  reviewLink: string;
  visitNumber: number;
  channel: "email" | "sms";
}) {
  await ensureSheetWithHeaders(
    args.sheets,
    args.spreadsheetId,
    args.tabName,
    REVIEW_SENT_LOG_HEADERS
  );

  await args.sheets.spreadsheets.values.append({
    spreadsheetId: args.spreadsheetId,
    range: `${args.tabName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        args.sentAt,
        args.phone,
        args.name,
        args.eventId,
        args.officeKey,
        args.reviewLink,
        args.visitNumber,
        args.channel,
        "",
      ]],
    },
  });
}

export async function markReviewRequestClicked(args: {
  sheets: SheetsClient;
  spreadsheetId: string;
  tabName: string;
  clickedAt: string;
  phone: string;
  name: string;
  eventId: string;
  officeKey: string;
  reviewLink: string;
  visitNumber: number;
}) {
  await ensureSheetWithHeaders(
    args.sheets,
    args.spreadsheetId,
    args.tabName,
    REVIEW_SENT_LOG_HEADERS
  );

  const response = await args.sheets.spreadsheets.values.get({
    spreadsheetId: args.spreadsheetId,
    range: `${args.tabName}!A2:I`,
  });
  const rows = response.data.values || [];

  const matchingIndex = rows.findIndex((row) => {
    const rowEventId = String(row[3] || "").trim();
    const rowPhone = normalizePhone(String(row[1] || ""));
    const rowVisitNumber = Number(String(row[6] || "").trim());

    return (
      (rowEventId && rowEventId === args.eventId) ||
      (rowPhone === normalizePhone(args.phone) &&
        rowVisitNumber === args.visitNumber)
    );
  });

  if (matchingIndex >= 0) {
    const sheetRow = matchingIndex + 2;
    await args.sheets.spreadsheets.values.update({
      spreadsheetId: args.spreadsheetId,
      range: `${args.tabName}!I${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[args.clickedAt]] },
    });
    return;
  }

  await args.sheets.spreadsheets.values.append({
    spreadsheetId: args.spreadsheetId,
    range: `${args.tabName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        "",
        args.phone,
        args.name,
        args.eventId,
        args.officeKey,
        args.reviewLink,
        args.visitNumber,
        "email",
        args.clickedAt,
      ]],
    },
  });
}
