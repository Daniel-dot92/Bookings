"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import Calendar from "@/app/components/Calendar";
import {
  type BookingLocale,
  type OfficeKey,
  type TherapistSelectionKey,
  getOfficeDefinition,
  getOfficeTherapists,
  getTherapistDefinition,
  getTherapistSelectionOptions,
} from "@/app/lib/booking-config";
import { fmtDateHeader } from "@/app/lib/ui";

type Slot = { time: string; available: boolean };

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  procedure: string;
  symptoms?: string;
  reviewSmsConsent: boolean;
};

type BookAPIResponse = {
  ok?: boolean;
  error?: string;
  eventId?: string;
  sheetsOk?: boolean;
  sheetsErr?: string;
  confirmationSmsOk?: boolean;
  confirmationSmsErr?: string;
  therapistKey?: TherapistSelectionKey | null;
};

type ConfirmationState = {
  text: string;
  officeKey: OfficeKey;
  therapistKey: Exclude<TherapistSelectionKey, "any"> | null;
};

type Props = {
  locale: BookingLocale;
  initialOfficeKey?: OfficeKey | null;
  lockedOffice?: boolean;
};

type Copy = {
  heroTitle: string;
  heroSubtitle: string;
  officeStepTitle: string;
  officeStepText: string;
  officeChoosePrompt: string;
  officeTherapistsSuffix: string;
  officeSelectCta: string;
  selectedOfficeLabel: string;
  selectedOfficeHint: string;
  changeOfficeCta: string;
  mapsCta: string;
  mapsShortCta: string;
  reviewsCta: string;
  reviewsCountLabel: (count: number) => string;
  studioPhotoLabel: string;
  datePanelTitle: string;
  therapistPanelTitle: string;
  therapistPanelHint: string;
  anyTherapistLabel: string;
  anyTherapistSubtitle: string;
  firstFreeLoading: (dateLabel: string) => string;
  firstFreeReady: (time: string, dateLabel: string) => string;
  noFirstFree: (dateLabel: string) => string;
  selectedChip: string;
  selectedTherapistLabel: string;
  timezoneLabel: string;
  timezoneDotLabel: string;
  availabilityTitle: string;
  loadingSlots: string;
  noSlots: string;
  bookCta: string;
  packageLabel: string;
  packageSessions: string;
  packageHint: string;
  noSixty: string;
  noNinety: string;
  chooseTimeError: string;
  formTitle: string;
  firstName: string;
  lastName: string;
  phone: string;
  procedure: string;
  email: string;
  symptoms: string;
  firstNamePlaceholder: string;
  lastNamePlaceholder: string;
  phonePlaceholder: string;
  procedurePlaceholder: string;
  emailPlaceholder: string;
  symptomsPlaceholder: string;
  reviewSmsConsentLabel: string;
  cancel: string;
  submit: string;
  submitting: string;
  confirmationTitle: string;
  confirmationBack: string;
  addressLabel: string;
  phoneLabel: string;
  chooseOfficeEmptyTitle: string;
  chooseOfficeEmptyText: string;
};

const COPY: Record<BookingLocale, Copy> = {
  bg: {
    heroTitle: "Изберете най-удобния обект и запазете час",
    heroSubtitle:
      "Първо изберете студио. След това ще покажем само терапевтите, които работят там, и реално свободните часове за избрания обект.",
    officeStepTitle: "1. Изберете обект",
    officeStepText: "Локация, адрес и екип за по-ясна ориентация още от първата стъпка.",
    officeChoosePrompt: "Изберете студио, за да заредим терапевтите и свободните часове.",
    officeTherapistsSuffix: "терапевти",
    officeSelectCta: "Избери този обект",
    selectedOfficeLabel: "Избран обект",
    selectedOfficeHint: "Показваме само терапевтите и часовете за тази локация.",
    changeOfficeCta: "Смени обекта",
    mapsCta: "Виж в Google Maps",
    mapsShortCta: "Google Maps",
    reviewsCta: "Ревюта",
    reviewsCountLabel: (count) => `${count} ревюта`,
    studioPhotoLabel: "Снимка",
    datePanelTitle: "2. Изберете дата и час",
    therapistPanelTitle: "3. Изберете терапевт",
    therapistPanelHint: "Виждате само специалистите, които работят в избрания обект.",
    anyTherapistLabel: "Най-ранен свободен час",
    anyTherapistSubtitle: "Избор по наличност",
    firstFreeLoading: (dateLabel) => `Проверка за свободни часове на ${dateLabel}...`,
    firstFreeReady: (time, dateLabel) => `Първи свободен: ${time} на ${dateLabel}`,
    noFirstFree: (dateLabel) => `Няма свободни часове на ${dateLabel}`,
    selectedChip: "Избран",
    selectedTherapistLabel: "Избран терапевт",
    timezoneLabel: "Локално време за избрания обект",
    timezoneDotLabel: "Europe/Sofia",
    availabilityTitle: "Налични часове",
    loadingSlots: "Зареждане…",
    noSlots: "Няма свободни часове за този ден.",
    bookCta: "запази",
    packageLabel: "Пакет 5 процедури",
    packageSessions: "5 x 1 час",
    packageHint: "Пакетът се закупува на място и е с валидност 6 месеца.",
    noSixty: "Няма свободен 60-мин интервал за тази дата.",
    noNinety: "Няма свободен 90-мин интервал за тази дата.",
    chooseTimeError: "Моля, изберете час.",
    formTitle: "Попълнете формата, за да запазите час",
    firstName: "Име",
    lastName: "Фамилия",
    phone: "Телефон",
    procedure: "Процедура",
    email: "Имейл",
    symptoms: "Опишете симптомите си",
    firstNamePlaceholder: "Вашето име",
    lastNamePlaceholder: "Вашата фамилия",
    phonePlaceholder: "0888 123 456",
    procedurePlaceholder: "Процедура / услуга",
    emailPlaceholder: "your@email.com",
    symptomsPlaceholder:
      "Опишете болката, местоположение/разпространение, от кога е, кое я усилва/облекчава, предишни травми/изследвания и каква е целта Ви…",
    reviewSmsConsentLabel: "Съгласен/на съм да получа последващ имейл за ревю след посещението.",
    cancel: "Откажи",
    submit: "Запази",
    submitting: "Изпращане…",
    confirmationTitle: "Потвърждение",
    confirmationBack: "Назад към сайта",
    addressLabel: "Адрес",
    phoneLabel: "Телефон",
    chooseOfficeEmptyTitle: "Изберете обект, за да продължите",
    chooseOfficeEmptyText:
      "След като изберете студио, ще покажем наличните терапевти и свободните часове точно за тази локация.",
  },
  en: {
    heroTitle: "Choose the studio that suits you and book an appointment",
    heroSubtitle:
      "Start by selecting a location. We will then show only the therapists working there and the real-time availability for that studio.",
    officeStepTitle: "1. Choose a location",
    officeStepText: "Address, team and availability context right from the first step.",
    officeChoosePrompt: "Choose a studio to load therapists and available times.",
    officeTherapistsSuffix: "therapists",
    officeSelectCta: "Choose this studio",
    selectedOfficeLabel: "Selected studio",
    selectedOfficeHint: "We are showing therapists and times only for this location.",
    changeOfficeCta: "Change studio",
    mapsCta: "Open in Google Maps",
    mapsShortCta: "Google Maps",
    reviewsCta: "Reviews",
    reviewsCountLabel: (count) => `${count} reviews`,
    studioPhotoLabel: "Studio photo",
    datePanelTitle: "2. Choose a date and time",
    therapistPanelTitle: "3. Choose a therapist",
    therapistPanelHint: "Only therapists working at the selected studio are shown.",
    anyTherapistLabel: "Earliest available slot",
    anyTherapistSubtitle: "Choose by availability",
    firstFreeLoading: (dateLabel) => `Checking availability for ${dateLabel}...`,
    firstFreeReady: (time, dateLabel) => `First available: ${time} on ${dateLabel}`,
    noFirstFree: (dateLabel) => `No available times on ${dateLabel}`,
    selectedChip: "Selected",
    selectedTherapistLabel: "Selected therapist",
    timezoneLabel: "Local time for the selected studio",
    timezoneDotLabel: "Europe/Sofia",
    availabilityTitle: "Available times",
    loadingSlots: "Loading…",
    noSlots: "No available times for this day.",
    bookCta: "book",
    packageLabel: "5-session package",
    packageSessions: "5 x 1 hour",
    packageHint: "The package is purchased on site and is valid for 6 months.",
    noSixty: "No available 60-minute interval for this date.",
    noNinety: "No available 90-minute interval for this date.",
    chooseTimeError: "Please choose a time.",
    formTitle: "Complete the form to book your appointment",
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone",
    procedure: "Procedure",
    email: "Email",
    symptoms: "Describe your symptoms",
    firstNamePlaceholder: "Your first name",
    lastNamePlaceholder: "Your last name",
    phonePlaceholder: "0888 123 456",
    procedurePlaceholder: "Procedure / service",
    emailPlaceholder: "your@email.com",
    symptomsPlaceholder:
      "Describe the pain, location/radiation, when it started, what makes it worse or easier, previous injuries/tests and your goal…",
    reviewSmsConsentLabel: "I agree to receive a follow-up review request by email after the appointment.",
    cancel: "Cancel",
    submit: "Book",
    submitting: "Sending…",
    confirmationTitle: "Confirmation",
    confirmationBack: "Back to the website",
    addressLabel: "Address",
    phoneLabel: "Phone",
    chooseOfficeEmptyTitle: "Choose a studio to continue",
    chooseOfficeEmptyText:
      "Once you select a studio, we will show the therapists and free times for that exact location.",
  },
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatGoogleRating(locale: BookingLocale, rating: number) {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating);
}

async function readResponseError(res: Response) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = (await res.json()) as { error?: string };
    return json.error || `HTTP ${res.status}`;
  }

  const text = await res.text();
  return text || `HTTP ${res.status}`;
}

function getEmptyFirstFreeMap(options: TherapistSelectionKey[]) {
  return options.reduce<Record<string, string | null>>((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});
}

export default function BookingAppClient({
  locale,
  initialOfficeKey = null,
  lockedOffice = false,
}: Props) {
  const copy = COPY[locale];
  const [date, setDate] = React.useState<Date | null>(null);
  const [officeKey, setOfficeKey] = React.useState<OfficeKey | null>(initialOfficeKey);
  const [duration, setDuration] = React.useState<30 | 60 | 90>(60);
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = React.useState<string | null>(null);
  const [therapist, setTherapist] = React.useState<TherapistSelectionKey | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmation, setConfirmation] = React.useState<ConfirmationState | null>(null);
  const [hourAvailable, setHourAvailable] = React.useState(true);
  const [ninetyAvailable, setNinetyAvailable] = React.useState(true);
  const [note, setNote] = React.useState<string | null>(null);
  const [firstFreeByTherapist, setFirstFreeByTherapist] = React.useState<Record<string, string | null>>({});
  const [firstFreeLoading, setFirstFreeLoading] = React.useState(false);
  const [form, setForm] = React.useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    procedure: "",
    symptoms: "",
    reviewSmsConsent: true,
  });

  const listRef = React.useRef<HTMLDivElement>(null);
  const bookingSectionRef = React.useRef<HTMLDivElement | null>(null);
  const timeSectionRef = React.useRef<HTMLDivElement | null>(null);
  const formSectionRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    while (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    setDate(d);
  }, []);

  React.useEffect(() => {
    if (!initialOfficeKey) return;
    setOfficeKey(initialOfficeKey);
    setSelectedTime(null);
    setSlots([]);
    setError(null);
    setNote(null);
    setConfirmation(null);
  }, [initialOfficeKey]);

  const selectedOffice = officeKey ? getOfficeDefinition(officeKey) : null;
  const therapistOptions = officeKey ? getTherapistSelectionOptions(officeKey) : [];
  const selectedTherapist =
    therapist && therapist !== "any" ? getTherapistDefinition(therapist) : null;

  React.useEffect(() => {
    if (!officeKey) {
      setTherapist(null);
      setFirstFreeByTherapist({});
      return;
    }

    const options = getTherapistSelectionOptions(officeKey);
    setFirstFreeByTherapist(getEmptyFirstFreeMap(options));
    setTherapist((current) => {
      if (current && options.includes(current)) return current;
      return options[0] || null;
    });
  }, [officeKey]);

  const setDurationSafe = (value: 30 | 60 | 90) => {
    setSelectedTime(null);
    setError(null);
    setNote(null);
    setDuration(value);
  };

  const scrollToBookingSection = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const anchor = bookingSectionRef.current;
    if (!anchor) return;
    const header = document.querySelector(".tb-header") as HTMLElement | null;
    const offset = header ? header.offsetHeight + 12 : 72;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const y = anchor.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      });
    });
  }, []);

  const scrollToTimeSection = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const anchor = timeSectionRef.current;
    if (!anchor) return;
    const header = document.querySelector(".tb-header") as HTMLElement | null;
    const offset = (header?.offsetHeight || 64) + 12;
    const top = anchor.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  const selectTherapistAndShowTimes = React.useCallback(
    (key: TherapistSelectionKey) => {
      setTherapist(key);

      // The section already exists, so this also works when the active therapist is tapped again.
      window.requestAnimationFrame(() => {
        scrollToTimeSection();
        window.setTimeout(scrollToTimeSection, 180);
      });
    },
    [scrollToTimeSection]
  );

  const load = React.useCallback(async () => {
    if (!date || !officeKey || !therapist) return;
    setLoading(true);
    setError(null);
    setNote(null);

    try {
      const d = ymd(date);
      const params = new URLSearchParams({
        date: d,
        duration: String(duration),
        location: officeKey,
        therapist,
      });
      const res = await fetch(`/api/availability?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await readResponseError(res));
      const json = (await res.json()) as { slots?: Slot[] };
      const list = Array.isArray(json.slots) ? json.slots : [];

      if (duration === 60) {
        const hasHour = list.some((slot) => slot.available);
        setHourAvailable(hasHour);
        if (!hasHour) setNote(copy.noSixty);
      } else if (duration === 90) {
        const hasNinety = list.some((slot) => slot.available);
        setNinetyAvailable(hasNinety);
        if (!hasNinety) setNote(copy.noNinety);
      } else {
        setHourAvailable(true);
        setNinetyAvailable(true);
      }

      setSlots(list);
    } catch (e: unknown) {
      setSlots([]);
      setError(e instanceof Error ? e.message : copy.loadingSlots);
    } finally {
      setLoading(false);
    }
  }, [copy.loadingSlots, copy.noNinety, copy.noSixty, date, duration, officeKey, therapist]);

  const loadFirstFreeByTherapist = React.useCallback(async () => {
    if (!date || !officeKey) return;

    const options = getTherapistSelectionOptions(officeKey);
    const d = ymd(date);
    setFirstFreeLoading(true);

    try {
      const responses = await Promise.all(
        options.map(async (key) => {
          const params = new URLSearchParams({
            date: d,
            duration: String(duration),
            location: officeKey,
            therapist: key,
          });
          const res = await fetch(`/api/availability?${params.toString()}`, {
            cache: "no-store",
          });
          if (!res.ok) return [key, null] as const;

          const json = (await res.json()) as { slots?: Slot[] };
          const list = Array.isArray(json.slots) ? json.slots : [];
          const first = list.find((slot) => slot.available)?.time ?? null;
          return [key, first] as const;
        })
      );

      const next = getEmptyFirstFreeMap(options);
      responses.forEach(([key, value]) => {
        next[key] = value;
      });
      setFirstFreeByTherapist(next);
    } catch {
      setFirstFreeByTherapist(getEmptyFirstFreeMap(options));
    } finally {
      setFirstFreeLoading(false);
    }
  }, [date, duration, officeKey]);

  React.useEffect(() => {
    if (date && officeKey && therapist) void load();
  }, [date, load, officeKey, therapist]);

  React.useEffect(() => {
    if (date && officeKey) void loadFirstFreeByTherapist();
  }, [date, loadFirstFreeByTherapist, officeKey]);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [date, duration, officeKey, therapist]);

  React.useEffect(() => {
    setSelectedTime(null);
    setNote(null);
  }, [date, officeKey, therapist]);

  React.useEffect(() => {
    if (!selectedTime || !formSectionRef.current) return;
    const anchor = formSectionRef.current;
    const header = document.querySelector(".tb-header") as HTMLElement | null;
    const offset = header ? header.offsetHeight + 10 : 70;
    const y = anchor.getBoundingClientRect().top + window.scrollY - offset;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "smooth" });
      });
    });
  }, [selectedTime]);

  function handleOfficeSelect(nextOfficeKey: OfficeKey) {
    setOfficeKey(nextOfficeKey);
    setSelectedTime(null);
    setSlots([]);
    setError(null);
    setNote(null);
    setConfirmation(null);
    window.setTimeout(scrollToBookingSection, 220);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTime || !date || !officeKey || !therapist) {
      setError(copy.chooseTimeError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body = {
        location: officeKey,
        date: ymd(date),
        time: selectedTime,
        duration,
        therapist,
        ...form,
      };

      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const ct = res.headers.get("content-type") || "";
      let data: BookAPIResponse | null = null;
      if (ct.includes("application/json")) {
        data = (await res.json()) as BookAPIResponse;
      } else {
        const text = await res.text();
        throw new Error(`Server returned ${res.status}. Not JSON: ${text.slice(0, 120)}`);
      }

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Booking error (HTTP ${res.status}).`);
      }

      const [h, m] = selectedTime.split(":").map((n) => Number(n));
      const start = new Date(date);
      start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const toHHMM = (d: Date) =>
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

      const office = getOfficeDefinition(officeKey);
      const resolvedTherapistKey: TherapistSelectionKey | null =
        data?.therapistKey && data.therapistKey !== "any" ? data.therapistKey : therapist;
      const therapistName =
        resolvedTherapistKey && resolvedTherapistKey !== "any"
          ? getTherapistDefinition(resolvedTherapistKey).name[locale]
          : "";

      const text =
        `${locale === "bg" ? "Успешно запазихте час!" : "Your appointment is confirmed!"} ` +
        `${fmtDateHeader(date, locale)} • ${toHHMM(start)}–${toHHMM(end)} (${duration} ${locale === "bg" ? "мин" : "min"})` +
        `${therapistName ? ` • ${therapistName}` : ""}` +
        ` • ${office.copy[locale].district}`;

      setConfirmation({
        text,
        officeKey,
        therapistKey:
          resolvedTherapistKey && resolvedTherapistKey !== "any"
            ? resolvedTherapistKey
            : null,
      });
      setSelectedTime(null);
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        procedure: "",
        symptoms: "",
        reviewSmsConsent: true,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy.loadingSlots);
    } finally {
      setLoading(false);
    }
  }

  const isNoSixtyMinuteNote = Boolean(note && note.includes("60"));
  const officeChoices = ["studentski-grad", "mladost-1a"] as OfficeKey[];
  const durationLabel = `${duration} ${locale === "bg" ? "мин" : "min"}`;
  const ui =
    locale === "bg"
      ? {
          heroEyebrow: "DM Physio Booking",
          heroStatA: "2 локации",
          heroStatB: "реални свободни часове",
          heroStatC: "Имейл напомняне",
          processTitle: "Как минава записването",
          processText:
            "Избираш локация, виждаш терапевтите само за този обект и резервираш точен свободен час без излишно лутане.",
          processSteps: [
            "Избери обект според квартала, адреса и екипа.",
            "Виж терапевтите и часовете само за тази локация.",
            "Попълни данните си и потвърди часа.",
          ],
          officeText:
            "Всеки обект има собствен екип и отделна наличност, затова започваме с правилната локация.",
          officeMetaLabel: "Екип на място",
          officeMetaCta: "Виж свободни часове",
          officeHintTitle: "Първо избери обект",
          officeHintText:
            "След като посочиш студио, зареждаме терапевтите и реалните свободни часове само за тази локация.",
          pathTitle: "Твоят избор досега",
          pathSubtitle: "Стъпките се обновяват в реално време, докато резервираш.",
          pathOfficePending: "Избери обект",
          pathDatePending: "Избери дата",
          pathTherapistPending: "Избери терапевт",
          pathTimePending: "Избери час",
          scheduleTitle: "Избери дата и терапевт",
          scheduleText:
            "Първо ориентирай деня си в календара, после виж кой специалист работи в избрания обект.",
          slotsTitle: "Свободни часове",
          slotsText:
            "Показваме само реално наличните слотове за избраните локация, терапевт и продължителност.",
          slotEmptyTitle: "Още няма избран час",
          slotEmptyText: "Избери слот, за да отворим формата за записване отдолу.",
          formSectionTitle: "Данни за резервацията",
          formSectionText:
            "Попълни кратко описание на случая си и ще получиш потвърждение заедно с напомняне.",
          confirmationBadge: "Записването е прието",
          confirmationNote: "За промяна или отказ на часа се обадете на",
          anyTherapistSummary: "Най-ранен свободен терапевт",
          busyLabel: "Заето",
        }
      : {
          heroEyebrow: "DM Physio Booking",
          heroStatA: "2 locations",
          heroStatB: "live availability",
          heroStatC: "Email reminder",
          processTitle: "How booking works",
          processText:
            "Choose a studio first, then see only the therapists who work there and the actual free slots for that location.",
          processSteps: [
            "Pick the studio that fits your area, address and team.",
            "See therapists and times only for that location.",
            "Complete your details and confirm the appointment.",
          ],
          officeText:
            "Each location has its own team and its own availability, so we start with the right studio.",
          officeMetaLabel: "Team on site",
          officeMetaCta: "View free times",
          officeHintTitle: "Choose a location first",
          officeHintText:
            "Once you select a studio, we load the therapists and real free times only for that location.",
          pathTitle: "Your booking path",
          pathSubtitle: "These steps update in real time while you book.",
          pathOfficePending: "Choose studio",
          pathDatePending: "Choose date",
          pathTherapistPending: "Choose therapist",
          pathTimePending: "Choose time",
          scheduleTitle: "Choose date and therapist",
          scheduleText:
            "Start with the day in the calendar, then choose the specialist who works at the selected studio.",
          slotsTitle: "Available times",
          slotsText:
            "We show only real available slots for the selected location, therapist and duration.",
          slotEmptyTitle: "No time selected yet",
          slotEmptyText: "Choose a slot and we will open the booking form below.",
          formSectionTitle: "Booking details",
          formSectionText:
            "Add a short description of your case and you will receive a confirmation with a reminder.",
          confirmationBadge: "Booking confirmed",
          confirmationNote: "To reschedule or cancel, please call",
          anyTherapistSummary: "Earliest available therapist",
          busyLabel: "Busy",
        };
  const selectedTherapistSummary =
    therapist === "any"
      ? ui.anyTherapistSummary
      : selectedTherapist?.name[locale] || ui.pathTherapistPending;
  const selectedTimeSummary = selectedTime && date
    ? `${fmtDateHeader(date, locale)} • ${selectedTime}`
    : ui.pathTimePending;
  void selectedTherapistSummary;
  void selectedTimeSummary;
  const officeSectionTitle = copy.officeStepTitle.replace(/^\d+\.\s*/, "");
  const dateSectionTitle = locale === "bg" ? "Изберете дата" : "Choose date";
  const timeSectionTitle = locale === "bg" ? "Изберете час" : "Choose time";
  const singleTherapist = therapistOptions.length === 1 && therapistOptions[0] !== "any";
  const mainSiteOrigin =
    process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:4174"
      : "https://www.dmphysi0.com";

  if (!date) return <div className="min-h-screen bg-white" />;

  if (confirmation) {
    const office = getOfficeDefinition(confirmation.officeKey);
    const confirmedTherapist = confirmation.therapistKey
      ? getTherapistDefinition(confirmation.therapistKey)
      : null;
    const confirmationPhone = confirmedTherapist?.contactPhone || office.contactPhone;
    const confirmationTherapistName =
      confirmedTherapist?.name[locale] || (locale === "bg" ? "терапевта" : "the therapist");
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_40%,#ffffff_100%)]">
        <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
          <div className="overflow-hidden rounded-[34px] border border-emerald-200/80 bg-white shadow-[0_35px_100px_rgba(16,185,129,0.14)]">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.24),_transparent_34%),linear-gradient(135deg,#022c22_0%,#064e3b_55%,#0f766e_100%)] px-6 py-7 text-white md:px-8 md:py-9">
                <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
                  {ui.confirmationBadge}
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight">{copy.confirmationTitle}</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/90">{confirmation.text}</p>
                <p className="mt-4 max-w-lg text-sm leading-6 text-white/75">
                  {ui.confirmationNote} {confirmationTherapistName}: {" "}
                  <a
                    className="font-semibold text-white underline underline-offset-4"
                    href={`tel:${confirmationPhone}`}
                  >
                    {confirmationPhone}
                  </a>
                  .
                </p>
              </div>

              <div className="px-6 py-7 md:px-8 md:py-9">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {copy.selectedOfficeLabel}
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-900">
                    {office.copy[locale].name}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{office.copy[locale].district}</div>

                  <div className="mt-5 space-y-3 text-sm text-slate-700">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <strong className="text-slate-900">{copy.addressLabel}:</strong>{" "}
                      {office.copy[locale].address}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <strong className="text-slate-900">{copy.phoneLabel}:</strong>{" "}
                      <a
                        href={`tel:${confirmationPhone}`}
                        className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:opacity-80"
                      >
                        {confirmationPhone}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="https://dmphysi0.com"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    {copy.confirmationBack}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:py-10">
          {!lockedOffice && (
            <section>
              <h2 className="mb-4 text-2xl font-semibold tracking-tight text-slate-950">
                {officeSectionTitle}
              </h2>
              <div className="grid grid-cols-2 gap-3 lg:gap-4">
                {officeChoices.map((key) => {
                  const office = getOfficeDefinition(key);
                  const active = officeKey === key;
                  const officeCopy = office.copy[locale];
                  const therapistCount = getOfficeTherapists(key).length;

                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOfficeSelect(key)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleOfficeSelect(key);
                        }
                      }}
                      className={[
                        "cursor-pointer rounded-[26px] border bg-white p-3 text-left transition duration-200 sm:p-4",
                        active
                          ? "border-emerald-500 bg-emerald-50 shadow-[0_16px_40px_rgba(16,185,129,0.12)]"
                          : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
                      ].join(" ")}
                    >
                      <div className="flex h-full flex-col gap-3 md:grid md:grid-cols-[170px_minmax(0,1fr)] md:gap-4">
                        <div className="relative aspect-square overflow-hidden rounded-[22px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#e2e8f0_100%)]">
                          {office.photo ? (
                            <Image
                              src={office.photo}
                              alt={officeCopy.name}
                              width={600}
                              height={600}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs font-medium text-slate-500 sm:text-sm">
                              {copy.studioPhotoLabel}
                            </div>
                          )}

                          {active && (
                            <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white sm:px-3 sm:text-[11px]">
                              {copy.selectedChip}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="text-base font-semibold tracking-tight text-slate-950 sm:text-lg lg:text-[30px] lg:leading-[1.05]">
                            {officeCopy.district}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
                            {officeCopy.shortAddress}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 sm:px-3 sm:py-1.5 sm:text-xs">
                              {therapistCount} {copy.officeTherapistsSuffix}
                            </div>

                            {office.googleRating && office.googleReviewCount ? (
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-white sm:px-3 sm:py-1.5 sm:text-xs">
                                <svg
                                  viewBox="0 0 20 20"
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 fill-amber-300"
                                >
                                  <path d="M10 1.8l2.47 5 5.52.8-4 3.9.94 5.5L10 14.4 5.07 17l.94-5.5-4-3.9 5.52-.8L10 1.8Z" />
                                </svg>
                                <span>{formatGoogleRating(locale, office.googleRating)}</span>
                                <span className="h-1 w-1 rounded-full bg-white/40" />
                                <span className="text-white/80">
                                  {copy.reviewsCountLabel(office.googleReviewCount)}
                                </span>
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <a
                              href={office.mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 sm:h-10 sm:text-xs"
                            >
                              {copy.mapsShortCta}
                            </a>

                            {office.reviewsUrl ? (
                              <a
                                href={office.reviewsUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 sm:h-10 sm:text-xs"
                              >
                                {copy.reviewsCta}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {selectedOffice && therapist && (
          <>
            <div
              ref={bookingSectionRef}
              className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"
            >
              {lockedOffice && (
                <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.07)] xl:col-span-2">
                  <div className="grid md:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="bg-slate-100 p-3 md:p-4">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-white">
                        {selectedOffice.photo ? (
                          <Image
                            src={selectedOffice.photo}
                            alt={`${selectedOffice.copy[locale].name} - ${selectedOffice.copy[locale].address}`}
                            fill
                            sizes="(max-width: 767px) calc(100vw - 56px), 288px"
                            className="object-contain"
                            priority
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col justify-center p-5 md:p-7">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
                        DM Physio
                      </div>
                      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                        {selectedOffice.copy[locale].district}
                      </h1>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        {selectedOffice.copy[locale].address}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                      <a
                        href={selectedOffice.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-100"
                      >
                        {copy.mapsCta}
                      </a>
                      {selectedOffice.reviewStatus ? (
                        <span className="inline-flex h-10 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800">
                          {selectedOffice.reviewStatus[locale]}
                        </span>
                      ) : selectedOffice.reviewsUrl ? (
                        <a
                          href={selectedOffice.reviewsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                        >
                          {copy.reviewsCta}
                        </a>
                      ) : null}
                      <Link
                        href={locale === "en" ? "/en/book" : "/book"}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {copy.changeOfficeCta}
                      </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
                <div className="p-5 lg:p-6">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {dateSectionTitle}
                  </h2>
                  <div className="mt-4">
                    <Calendar value={date} onChange={setDate} locale={locale} />
                  </div>

                  <div className="mt-6 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <h3 className="text-base font-semibold text-slate-900">
                        {copy.therapistPanelTitle.replace(/^\d+\.\s*/, "")}
                      </h3>
                    </div>

                    <div
                      className={
                        singleTherapist
                          ? "grid grid-cols-1 gap-3 p-3 sm:p-4 md:p-5"
                          : "grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4 lg:grid-cols-3"
                      }
                    >
                      {therapistOptions.map((key) => {
                        const active = therapist === key;
                        const firstFree = firstFreeByTherapist[key] ?? null;
                        const item =
                          key === "any"
                            ? null
                            : getTherapistDefinition(key);
                        const officeSchedule =
                          officeKey && item ? item.schedule[officeKey] : undefined;
                        const label =
                          key === "any"
                            ? copy.anyTherapistLabel
                            : item?.name[locale] || "";
                        const subtitle =
                          key === "any"
                            ? copy.anyTherapistSubtitle
                            : locale === "bg"
                              ? `Работно време: ${officeSchedule?.weekdays?.start || ""}-${officeSchedule?.weekdays?.end || ""}`
                              : `Working hours: ${officeSchedule?.weekdays?.start || ""}-${officeSchedule?.weekdays?.end || ""}`;

                        const availabilitySummary = firstFreeLoading
                          ? locale === "bg"
                            ? "Проверка..."
                            : "Checking..."
                          : firstFree
                            ? `${locale === "bg" ? "Свободен час" : "Free slot"}: ${firstFree}`
                            : locale === "bg"
                              ? "Няма часове"
                              : "No slots";
                        const profileUrl = item
                          ? `${mainSiteOrigin}${locale === "en" ? "/en/therapists" : "/therapists"}/${item.profileAnchor}.html`
                          : null;

                        return (
                          <div
                            key={key}
                            className={[
                              "relative overflow-hidden rounded-[24px] border text-left transition",
                              singleTherapist ? "mx-auto w-full max-w-xl" : "",
                              active
                                ? "border-slate-950 bg-slate-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
                            ].join(" ")}
                          >
                            {active && (
                              <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                                <span className="sm:hidden" aria-hidden="true">✓</span>
                                <span className="hidden sm:inline">{copy.selectedChip}</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => selectTherapistAndShowTimes(key)}
                              aria-pressed={active}
                              className={`block w-full text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500 ${
                                singleTherapist ? "p-3 sm:p-4" : "p-2.5 sm:p-3"
                              }`}
                            >
                              <div
                                className={
                                  key === "any"
                                    ? "grid grid-cols-[78px_minmax(0,1fr)] items-center gap-3 sm:block sm:space-y-3"
                                    : singleTherapist
                                      ? "grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[125px_minmax(0,1fr)] sm:gap-5"
                                      : "grid grid-cols-[78px_minmax(0,1fr)] items-center gap-3 sm:block sm:space-y-3"
                                }
                              >
                                {key === "any" && (
                                  <div className="mx-auto flex aspect-[4/5] w-[78px] items-center justify-center rounded-[16px] bg-[linear-gradient(145deg,#0f766e,#0f172a)] p-2 text-center text-[10px] font-semibold leading-4 text-white sm:w-[118px] sm:p-3 sm:text-xs sm:leading-5">
                                    {locale === "bg" ? "Покажи ми най-ранния свободен час" : "Show me the earliest available time"}
                                  </div>
                                )}

                                {key !== "any" && item && (
                                  <div className={`relative aspect-[4/5] overflow-hidden rounded-[18px] border border-slate-200 bg-slate-100 ${
                                    singleTherapist ? "w-[88px] sm:w-[125px]" : "mx-auto w-[78px] sm:w-[118px]"
                                  }`}>
                                    {item.photo ? (
                                      <Image
                                        src={item.photo}
                                        alt={label}
                                        fill
                                        sizes={singleTherapist ? "125px" : "118px"}
                                        className="object-cover object-top"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-600">
                                        {label.charAt(0)}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="text-base font-semibold leading-tight text-slate-950 sm:text-lg">{label}</div>
                                  <div className="mt-1 text-[11px] leading-5 text-slate-600 sm:text-xs">{subtitle}</div>
                                  <div
                                    className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium sm:px-3 sm:text-[11px] ${
                                      !firstFreeLoading && !firstFree
                                        ? "bg-rose-50 text-rose-700"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {availabilitySummary}
                                  </div>
                                </div>
                              </div>
                            </button>

                            {profileUrl ? (
                              <a
                                href={profileUrl}
                                className="flex min-h-10 items-center justify-center border-t border-slate-200 bg-white px-3 text-xs font-semibold text-teal-800 transition hover:bg-teal-50"
                              >
                                {locale === "bg" ? "Повече информация" : "More information"}
                              </a>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div
                ref={timeSectionRef}
                className="booking-time-section w-full shrink-0 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.05)]"
                style={{ scrollMarginTop: "calc(var(--tb-h, 64px) + 10px)" }}
              >
                <div className="px-5 py-5">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {timeSectionTitle}
                  </h2>
                  <div className="mt-2 text-lg font-medium text-slate-700">
                    {fmtDateHeader(date, locale)}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {copy.availabilityTitle}
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {durationLabel}
                    </div>
                  </div>

                    <div className="mt-4 inline-flex rounded-full border border-slate-300 bg-slate-50 p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setDurationSafe(30)}
                        className={`h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                          duration === 30
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-700 hover:bg-white"
                        }`}
                        aria-pressed={duration === 30}
                      >
                        30 {locale === "bg" ? "мин" : "min"}
                      </button>

                      <button
                        type="button"
                        onClick={() => hourAvailable && setDurationSafe(60)}
                        disabled={!hourAvailable}
                        className={`h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                          duration === 60
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-700 hover:bg-white"
                        } ${!hourAvailable ? "cursor-not-allowed opacity-50" : ""}`}
                        title={!hourAvailable ? copy.noSixty : ""}
                        aria-pressed={duration === 60}
                      >
                        60 {locale === "bg" ? "мин" : "min"}
                      </button>

                      <button
                        type="button"
                        onClick={() => ninetyAvailable && setDurationSafe(90)}
                        disabled={!ninetyAvailable}
                        className={`h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                          duration === 90
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-700 hover:bg-white"
                        } ${!ninetyAvailable ? "cursor-not-allowed opacity-50" : ""}`}
                        title={!ninetyAvailable ? copy.noNinety : ""}
                        aria-pressed={duration === 90}
                      >
                        90 {locale === "bg" ? "мин" : "min"}
                      </button>
                    </div>

                  {note && slots.length > 0 && (
                    <div
                      className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
                        isNoSixtyMinuteNote
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {note}
                    </div>
                  )}
                </div>

                <div className="p-5 pt-4">
                  {loading ? (
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-600">
                      {copy.loadingSlots}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-rose-300 bg-rose-50 px-5 py-8 text-sm font-semibold text-rose-700">
                      {copy.noSlots}
                    </div>
                  ) : (
                    <div
                      ref={listRef}
                      className="max-h-[420px] overflow-y-auto pr-1"
                    >
                      <div className="flex flex-col gap-3">
                        {slots.map((slot) => {
                          const selected = selectedTime === slot.time;
                          const base =
                            "flex h-[74px] w-full items-center justify-between rounded-[22px] border px-4 text-sm transition";

                          if (!slot.available) {
                            return (
                              <button
                                key={slot.time}
                                type="button"
                                disabled
                                className={`${base} cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400`}
                              >
                                <span className="flex items-center gap-3">
                                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                  <span className="text-sm font-medium">{slot.time}</span>
                                </span>
                                <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                                  {ui.busyLabel}
                                </span>
                              </button>
                            );
                          }

                          return (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => setSelectedTime(slot.time)}
                              className={
                                selected
                                  ? `${base} border-slate-950 bg-slate-950 text-white shadow-sm`
                                  : `${base} border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50`
                              }
                            >
                              <span className="flex items-center gap-3">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    selected ? "bg-white" : "bg-emerald-500"
                                  }`}
                                />
                                <span>
                                  <span className="block text-base font-semibold">{slot.time}</span>
                                  <span
                                    className={`block text-[11px] uppercase tracking-[0.18em] ${
                                      selected ? "text-slate-300" : "text-slate-500"
                                    }`}
                                  >
                                    {durationLabel}
                                  </span>
                                </span>
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                  selected
                                    ? "bg-white/10 text-white"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {copy.bookCta}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              ref={formSectionRef}
              className="h-px"
              style={{ scrollMarginTop: "calc(var(--tb-h, 64px) + 10px)" }}
            />

            {selectedTime && (
              <div className="mt-6 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {ui.formSectionTitle}
                  </div>
                  <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">
                    {copy.formTitle}
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                    {fmtDateHeader(date, locale)} • {selectedTime} • {duration}{" "}
                    {locale === "bg" ? "мин" : "min"} • {selectedOffice.copy[locale].district}
                    {selectedTherapist ? ` • ${selectedTherapist.name[locale]}` : ""}
                  </div>
                </div>

                <form onSubmit={submit} className="space-y-4 px-6 py-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        {copy.firstName}
                      </label>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder={copy.firstNamePlaceholder}
                        required
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        {copy.lastName}
                      </label>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder={copy.lastNamePlaceholder}
                        required
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        {copy.phone}
                      </label>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder={copy.phonePlaceholder}
                        required
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        {copy.procedure}
                      </label>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder={copy.procedurePlaceholder}
                        required
                        value={form.procedure}
                        onChange={(e) => setForm({ ...form, procedure: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      {copy.email}
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder={copy.emailPlaceholder}
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      {copy.symptoms}
                    </label>
                    <textarea
                      className="min-h-[150px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder={copy.symptomsPlaceholder}
                      value={form.symptoms || ""}
                      onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                    />
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <label className="flex items-start gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        checked={form.reviewSmsConsent}
                        onChange={(e) => setForm({ ...form, reviewSmsConsent: e.target.checked })}
                      />
                      <span>{copy.reviewSmsConsentLabel}</span>
                    </label>
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => window.history.back()}
                      className="h-12 rounded-full border border-slate-300 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      {copy.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="h-12 rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#0ea5e9_45%,#10b981_100%)] text-sm font-semibold text-white shadow-[0_18px_36px_rgba(14,165,233,0.18)] transition hover:opacity-95 disabled:opacity-60"
                    >
                      {loading ? copy.submitting : copy.submit}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
