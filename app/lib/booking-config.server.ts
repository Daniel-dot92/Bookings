import {
  OFFICE_ORDER,
  type OfficeKey,
  getOfficeDefinition,
} from "@/app/lib/booking-config";

const MLADOST_CALENDAR_ID =
  "cb95d195379bc168cc14495446bbedb23e2625b3963555dde4ad735d09da34c2@group.calendar.google.com";

export function getCalendarIdForOffice(officeKey: OfficeKey) {
  if (officeKey === "studentski-grad") {
    return (
      (process.env.BOOKING_CALENDAR_ID_STUDENTSKI || "").trim() ||
      (process.env.BOOKING_CALENDAR_ID || "").trim()
    );
  }

  if (officeKey === "mladost-1a") {
    return (
      (process.env.BOOKING_CALENDAR_ID_MLADOST || "").trim() ||
      MLADOST_CALENDAR_ID
    );
  }

  return "";
}

export function getManagedOffices() {
  return OFFICE_ORDER.map((officeKey) => {
    const office = getOfficeDefinition(officeKey);
    const calendarId = getCalendarIdForOffice(officeKey);
    return {
      officeKey,
      office,
      calendarId,
    };
  }).filter((entry) => entry.calendarId);
}

export function getManagedCalendarIds() {
  return getManagedOffices().map((entry) => entry.calendarId);
}
