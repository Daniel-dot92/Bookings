import { OFFICE_ORDER, type OfficeKey } from "@/app/lib/booking-config";
import { getSheets } from "@/app/lib/google";

const DEFAULT_BOOKING_TAB = "Bookings";
const DEFAULT_MLADOST_BOOKING_TAB = "Bookings - Mladost 1A";
const DEFAULT_REVIEW_TAB = "\u0418\u043c\u0435\u043d\u0430 \u0438 \u0442\u0435\u043b";
const DEFAULT_MLADOST_REVIEW_TAB =
  "\u0418\u043c\u0435\u043d\u0430 \u0438 \u0442\u0435\u043b - \u041c\u043b\u0430\u0434\u043e\u0441\u0442 1\u0410";
const DEFAULT_REVIEW_SENT_LOG_TAB = "Review SMS Sent";
const DEFAULT_MLADOST_REVIEW_SENT_LOG_TAB = "Review SMS Sent - Mladost 1A";

export const BOOKING_SHEET_HEADERS = [
  "Timestamp",
  "Date",
  "Time",
  "Duration",
  "First name",
  "Last name",
  "Email",
  "Phone",
  "Procedure",
  "Symptoms",
  "Event ID",
  "Therapist",
  "Office",
  "Source",
];

export const REVIEW_DIRECTORY_HEADERS = [
  "\u0418\u043c\u0435",
  "\u0422\u0435\u043b\u0435\u0444\u043e\u043d",
  "\u0418\u043c\u0435\u0439\u043b",
  "\u041a\u043e\u0433\u0430 \u0435 \u0437\u0430\u043f\u0438\u0441\u0430\u043d",
  "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f",
];

export const REVIEW_SENT_LOG_HEADERS = [
  "Sent At",
  "Phone",
  "Name",
  "Event ID",
  "Office",
  "Review Link",
];

type OfficeSheetConfig = {
  officeKey: OfficeKey;
  spreadsheetId: string;
  bookingTabName: string;
  reviewDirectoryTabName: string;
  reviewSentLogTabName: string;
};

function readTrimmedEnv(name: string) {
  return (process.env[name] || "").trim();
}

export function getSpreadsheetIdForOffice(officeKey: OfficeKey) {
  if (officeKey === "studentski-grad") {
    return readTrimmedEnv("SHEETS_SPREADSHEET_ID_STUDENTSKI") || readTrimmedEnv("SHEETS_SPREADSHEET_ID");
  }

  if (officeKey === "mladost-1a") {
    return readTrimmedEnv("SHEETS_SPREADSHEET_ID_MLADOST") || readTrimmedEnv("SHEETS_SPREADSHEET_ID");
  }

  return "";
}

export function getBookingTabNameForOffice(officeKey: OfficeKey) {
  if (officeKey === "studentski-grad") {
    return readTrimmedEnv("SHEETS_TAB_NAME_STUDENTSKI") || readTrimmedEnv("SHEETS_TAB_NAME") || DEFAULT_BOOKING_TAB;
  }

  if (officeKey === "mladost-1a") {
    return readTrimmedEnv("SHEETS_TAB_NAME_MLADOST") || DEFAULT_MLADOST_BOOKING_TAB;
  }

  return DEFAULT_BOOKING_TAB;
}

export function getReviewDirectoryTabNameForOffice(officeKey: OfficeKey) {
  if (officeKey === "studentski-grad") {
    return (
      readTrimmedEnv("REVIEW_SMS_SHEET_TAB_STUDENTSKI") ||
      readTrimmedEnv("REVIEW_SMS_SHEET_TAB") ||
      DEFAULT_REVIEW_TAB
    );
  }

  if (officeKey === "mladost-1a") {
    return readTrimmedEnv("REVIEW_SMS_SHEET_TAB_MLADOST") || DEFAULT_MLADOST_REVIEW_TAB;
  }

  return DEFAULT_REVIEW_TAB;
}

export function getReviewSentLogTabNameForOffice(officeKey: OfficeKey) {
  if (officeKey === "studentski-grad") {
    return (
      readTrimmedEnv("REVIEW_SENT_LOG_TAB_STUDENTSKI") ||
      readTrimmedEnv("REVIEW_SENT_LOG_TAB") ||
      DEFAULT_REVIEW_SENT_LOG_TAB
    );
  }

  if (officeKey === "mladost-1a") {
    return (
      readTrimmedEnv("REVIEW_SENT_LOG_TAB_MLADOST") ||
      DEFAULT_MLADOST_REVIEW_SENT_LOG_TAB
    );
  }

  return DEFAULT_REVIEW_SENT_LOG_TAB;
}

export function getSheetConfigForOffice(officeKey: OfficeKey): OfficeSheetConfig {
  return {
    officeKey,
    spreadsheetId: getSpreadsheetIdForOffice(officeKey),
    bookingTabName: getBookingTabNameForOffice(officeKey),
    reviewDirectoryTabName: getReviewDirectoryTabNameForOffice(officeKey),
    reviewSentLogTabName: getReviewSentLogTabNameForOffice(officeKey),
  };
}

export function getManagedOfficeSheetConfigs() {
  return OFFICE_ORDER.map(getSheetConfigForOffice).filter((entry) => entry.spreadsheetId);
}

export async function ensureSheetWithHeaders(
  sheets: ReturnType<typeof getSheets>,
  spreadsheetId: string,
  tabName: string,
  headers: string[]
) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const hasTab = (spreadsheet.data.sheets || []).some(
    (sheet) => sheet.properties?.title === tabName
  );

  if (!hasTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1:${String.fromCharCode(64 + headers.length)}1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [headers],
    },
  });
}
