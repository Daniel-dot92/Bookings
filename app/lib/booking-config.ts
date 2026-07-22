export type BookingLocale = "bg" | "en";
export type OfficeKey = "studentski-grad" | "mladost-1a";
export type TherapistKey = "daniel" | "elitsa" | "ivan";
export type TherapistSelectionKey = TherapistKey | "any";

export type ShiftWindow = {
  start: string;
  end: string;
};

type OfficeCopy = {
  name: string;
  district: string;
  address: string;
  shortAddress: string;
  cardTag: string;
};

type TherapistSchedule = Partial<
  Record<
    OfficeKey,
    {
      weekdays?: ShiftWindow;
      saturday?: ShiftWindow;
    }
  >
>;

export type OfficeDefinition = {
  key: OfficeKey;
  copy: Record<BookingLocale, OfficeCopy>;
  mapsUrl: string;
  reviewsUrl?: string;
  googleRating?: number;
  googleReviewCount?: number;
  reviewStatus?: Record<BookingLocale, string>;
  photo?: string;
  contactPhone: string;
  theme: {
    border: string;
    background: string;
    badge: string;
    glow: string;
  };
};

export type TherapistDefinition = {
  key: TherapistKey;
  name: Record<BookingLocale, string>;
  contactPhone: string;
  photo?: string;
  profileAnchor: string;
  schedule: TherapistSchedule;
};

export const OFFICE_DEFINITIONS: Record<OfficeKey, OfficeDefinition> = {
  "studentski-grad": {
    key: "studentski-grad",
    copy: {
      bg: {
        name: "Студио Студентски град",
        district: "Студентски град",
        address: "София, ул. Професор Христо Данов 19",
        shortAddress: "ул. Проф. Христо Данов 19",
        cardTag: "Студентски град",
      },
      en: {
        name: "Studentski Grad Studio",
        district: "Studentski Grad",
        address: "Sofia, 19 Prof. Hristo Danov St.",
        shortAddress: "19 Prof. Hristo Danov St.",
        cardTag: "Studentski Grad",
      },
    },
    mapsUrl: "https://maps.app.goo.gl/wxauVFpBzGxFJt4j8",
    reviewsUrl:
      "https://www.google.com/maps/search/?api=1&query=DM+Physio+Prof.+Hristo+Danov+19+Sofia",
    googleRating: 5,
    googleReviewCount: 65,
    photo: "/baner studentski.webp",
    contactPhone: "0883688414",
    theme: {
      border: "border-cyan-300/70",
      background:
        "bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.28),_transparent_42%),linear-gradient(145deg,rgba(15,23,42,1),rgba(8,47,73,0.96))]",
      badge: "bg-cyan-400/15 text-cyan-100 border border-cyan-200/25",
      glow: "shadow-[0_22px_55px_rgba(14,165,233,0.18)]",
    },
  },
  "mladost-1a": {
    key: "mladost-1a",
    copy: {
      bg: {
        name: "Студио Младост 1А",
        district: "Младост 1А",
        address: "София, ул. Кръстьо Раковски 12",
        shortAddress: "ул. Кръстьо Раковски 12",
        cardTag: "Младост 1А",
      },
      en: {
        name: "Mladost 1A Studio",
        district: "Mladost 1A",
        address: "Sofia, 12 Krastyo Rakovski St.",
        shortAddress: "12 Krastyo Rakovski St.",
        cardTag: "Mladost 1A",
      },
    },
    mapsUrl: "https://maps.app.goo.gl/xYi2heoA2kY44wLq5",
    reviewsUrl: "https://g.page/r/CVRkl_pUfEceEAE/review",
    photo: "/baner mladost.webp",
    contactPhone: "0898485320",
    theme: {
      border: "border-amber-300/70",
      background:
        "bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.28),_transparent_38%),linear-gradient(145deg,rgba(26,11,46,1),rgba(120,53,15,0.95))]",
      badge: "bg-amber-300/15 text-amber-50 border border-amber-200/25",
      glow: "shadow-[0_22px_55px_rgba(217,119,6,0.18)]",
    },
  },
};

export const THERAPIST_DEFINITIONS: Record<TherapistKey, TherapistDefinition> = {
  daniel: {
    key: "daniel",
    name: { bg: "Даниел Митев", en: "Daniel Mitev" },
    contactPhone: "0883688414",
    photo: "/daniel.webp",
    profileAnchor: "daniel-mitev",
    schedule: {
      "studentski-grad": {
        weekdays: { start: "13:00", end: "19:00" },
        saturday: { start: "13:00", end: "16:00" },
      },
    },
  },
  elitsa: {
    key: "elitsa",
    name: { bg: "Елица Колева", en: "Elitsa Koleva" },
    contactPhone: "0893673007",
    photo: "/elitsa.jpg",
    profileAnchor: "elitsa-koleva",
    schedule: {
      "studentski-grad": {
        weekdays: { start: "08:00", end: "13:00" },
        saturday: { start: "08:00", end: "13:00" },
      },
    },
  },
  ivan: {
    key: "ivan",
    name: { bg: "Иван Митев", en: "Ivan Mitev" },
    contactPhone: "0898485320",
    photo: "/ivan.webp",
    profileAnchor: "ivan-mitev",
    schedule: {
      "mladost-1a": {
        weekdays: { start: "08:00", end: "19:00" },
        saturday: { start: "08:00", end: "16:00" },
      },
    },
  },
};

export const OFFICE_ORDER: OfficeKey[] = ["studentski-grad", "mladost-1a"];
export const THERAPIST_ORDER: TherapistKey[] = ["daniel", "elitsa", "ivan"];

export function isOfficeKey(value: string | null | undefined): value is OfficeKey {
  return Boolean(value && value in OFFICE_DEFINITIONS);
}

export function isTherapistSelectionKey(
  value: string | null | undefined
): value is TherapistSelectionKey {
  return value === "any" || Boolean(value && value in THERAPIST_DEFINITIONS);
}

export function getOfficeDefinition(officeKey: OfficeKey) {
  return OFFICE_DEFINITIONS[officeKey];
}

export function getTherapistDefinition(therapistKey: TherapistKey) {
  return THERAPIST_DEFINITIONS[therapistKey];
}

export function getOfficeTherapists(officeKey: OfficeKey) {
  return THERAPIST_ORDER.filter(
    (therapistKey) => THERAPIST_DEFINITIONS[therapistKey].schedule[officeKey]
  );
}

export function getTherapistShift(
  officeKey: OfficeKey,
  therapistKey: TherapistKey,
  isSaturday: boolean
) {
  const officeSchedule = THERAPIST_DEFINITIONS[therapistKey].schedule[officeKey];
  if (!officeSchedule) return null;
  return isSaturday
    ? officeSchedule.saturday || officeSchedule.weekdays || null
    : officeSchedule.weekdays || null;
}

export function getTherapistSelectionOptions(officeKey: OfficeKey) {
  const therapists = getOfficeTherapists(officeKey);
  if (therapists.length <= 1) return therapists;
  return ["any", ...therapists] as TherapistSelectionKey[];
}
