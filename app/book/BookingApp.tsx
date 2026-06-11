// /app/book/BookingApp.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import Calendar from "@/app/components/Calendar";
import { fmtDateHeader } from "@/app/lib/ui";

type Slot = { time: string; available: boolean };

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  procedure: string;
  symptoms?: string;
};

type BookAPIResponse = {
  ok?: boolean;
  error?: string;
  eventId?: string;
  sheetsOk?: boolean;
  sheetsErr?: string;
};

type TherapistKey = "any" | "daniel" | "elitsa";

const THERAPISTS: Record<
  TherapistKey,
  { name: string; photo?: string; start?: string; end?: string }
> = {
  any: { name: "Без значение" },
  daniel: {
    name: "Даниел Митев",
    photo: "/therapists/daniel.jpg",
    start: "13:00",
    end: "19:00",
  },
  elitsa: {
    name: "Елица Колева",
    photo: "/therapists/elitsa.jpg",
    start: "08:00",
    end: "13:00",
  },
};

type FirstFreeMap = Record<TherapistKey, string | null>;

const NO_60_MIN_NOTE = "\u041d\u044f\u043c\u0430 \u0441\u0432\u043e\u0431\u043e\u0434\u0435\u043d 60-\u043c\u0438\u043d \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b \u0437\u0430 \u0442\u0430\u0437\u0438 \u0434\u0430\u0442\u0430.";
const EMPTY_FIRST_FREE: FirstFreeMap = {
  any: null,
  daniel: null,
  elitsa: null,
};
const PACKAGE_PRICE_LABEL = "Пакет 5 процедури";
const PACKAGE_PRICE_VALUE = "180 EUR";

// helpers
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BookingApp() {
  // базови състояния (инициализира се само на клиента)
  const [date, setDate] = React.useState<Date | null>(null);
  const [duration, setDuration] = React.useState<30 | 60 | 90>(60);
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = React.useState<string | null>(null);

  // терапевт
  const [therapist, setTherapist] = React.useState<TherapistKey>("any");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successText, setSuccessText] = React.useState<string | null>(null);

  // логика 60/90
  const [hourAvailable, setHourAvailable] = React.useState(true);
  const [ninetyAvailable, setNinetyAvailable] = React.useState(true);
  const [note, setNote] = React.useState<string | null>(null);
  const [firstFreeByTherapist, setFirstFreeByTherapist] =
    React.useState<FirstFreeMap>(EMPTY_FIRST_FREE);
  const [firstFreeLoading, setFirstFreeLoading] = React.useState(false);

  // форма
  const [form, setForm] = React.useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    procedure: "",
    symptoms: "",
  });

  // скрол
  const listRef = React.useRef<HTMLDivElement>(null);
  const timesSectionRef = React.useRef<HTMLDivElement | null>(null);
  const formSectionRef = React.useRef<HTMLDivElement | null>(null);

  // timezone
  const [mounted, setMounted] = React.useState(false);
  const [clientTz, setClientTz] = React.useState<string>("");

  React.useEffect(() => {
    setMounted(true);
    setClientTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // инициализация на датата само на клиента
  React.useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    while (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    setDate(d);
  }, []);

  const setDurationSafe = (d: 30 | 60 | 90) => {
    setSelectedTime(null);
    setError(null);
    setNote(null);
    setDuration(d);
  };

  // зареждане на слотовете (вкл. therapist)
  const load = React.useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);
    setNote(null);

    try {
      const d = ymd(date);
      const res = await fetch(
        `/api/availability?date=${d}&duration=${duration}&therapist=${therapist}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const json = (await res.json()) as { slots?: Slot[] };
      const list = Array.isArray(json.slots) ? json.slots : [];

      if (duration === 60) {
        const anyHour = list.some((s) => s.available);
        setHourAvailable(anyHour);
        if (!anyHour) setNote(NO_60_MIN_NOTE);
      } else if (duration === 90) {
        const any90 = list.some((s) => s.available);
        setNinetyAvailable(any90);
        if (!any90) setNote("Няма свободен 90-мин интервал за тази дата.");
      } else {
        setHourAvailable(true);
        setNinetyAvailable(true);
      }

      setSlots(list);
    } catch (e: unknown) {
      setSlots([]);
      setError(e instanceof Error ? e.message : "Грешка при зареждане.");
    } finally {
      setLoading(false);
    }
  }, [date, duration, therapist]);

  const loadFirstFreeByTherapist = React.useCallback(async () => {
    if (!date) return;

    const d = ymd(date);
    const keys: TherapistKey[] = ["any", "daniel", "elitsa"];
    setFirstFreeLoading(true);

    try {
      const responses = await Promise.all(
        keys.map(async (key) => {
          const res = await fetch(
            `/api/availability?date=${d}&duration=${duration}&therapist=${key}`,
            { cache: "no-store" }
          );
          if (!res.ok) return [key, null] as const;

          const json = (await res.json()) as { slots?: Slot[] };
          const list = Array.isArray(json.slots) ? json.slots : [];
          const first = list.find((s) => s.available)?.time ?? null;
          return [key, first] as const;
        })
      );

      const next: FirstFreeMap = { ...EMPTY_FIRST_FREE };
      responses.forEach(([key, value]) => {
        next[key] = value;
      });
      setFirstFreeByTherapist(next);
    } catch {
      setFirstFreeByTherapist({ ...EMPTY_FIRST_FREE });
    } finally {
      setFirstFreeLoading(false);
    }
  }, [date, duration]);

  React.useEffect(() => {
    if (date) void load();
  }, [date, load]);

  React.useEffect(() => {
    if (date) void loadFirstFreeByTherapist();
  }, [date, loadFirstFreeByTherapist]);

  function scrollToTimesOnMobile() {
    if (typeof window === "undefined" || window.innerWidth > 768) return;
    const anchor = timesSectionRef.current;
    if (!anchor) return;
    const header = document.querySelector(".tb-header") as HTMLElement | null;
    const offset = header ? header.offsetHeight + 10 : 66;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const y = anchor.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      });
    });
  }

  function handleTherapistSelect(key: TherapistKey) {
    setTherapist(key);
    window.setTimeout(scrollToTimesOnMobile, 180);
  }

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [date, duration, therapist]);

  React.useEffect(() => {
    setSelectedTime(null);
    setNote(null);
  }, [date, therapist]);

  // плавен скрол към формата
  React.useEffect(() => {
    if (!selectedTime || !formSectionRef.current) return;
    document.body.classList.remove("tb-no-scroll");
    const anchor = formSectionRef.current;
    const header = document.querySelector(".tb-header") as HTMLElement | null;
    const offset = header ? header.offsetHeight + 8 : 0;
    const y = anchor.getBoundingClientRect().top + window.scrollY - offset;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "smooth" });
      });
    });
  }, [selectedTime]);

  // submit
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTime || !date) {
      setError("Моля, изберете час.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const body = {
        date: ymd(date),
        time: selectedTime,
        duration,
        therapist, // ← към API
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
        throw new Error(
          `Server returned ${res.status}. Not JSON: ${text.slice(0, 120)}`
        );
      }
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Грешка при запис (HTTP ${res.status}).`);
      }

      // успех
      const [h, m] = selectedTime.split(":").map((n) => Number(n));
      const start = new Date(date);
      start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const toHHMM = (d: Date) =>
        `${String(d.getHours()).padStart(2, "0")}:${String(
          d.getMinutes()
        ).padStart(2, "0")}`;
      const tName = THERAPISTS[therapist].name;

      setSuccessText(
        `Успешно запазихте час! ${fmtDateHeader(
          date
        )} • ${toHHMM(start)}–${toHHMM(end)} (${duration} мин)` +
          (therapist !== "any" ? ` • Терапевт: ${tName}` : "")
      );

      setSelectedTime(null);
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        procedure: "",
        symptoms: "",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка при запис.");
    } finally {
      setLoading(false);
    }
  }

  // --- Потвърждение ---
  if (successText) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm">
            <div className="px-6 py-6">
              <h2 className="text-xl font-semibold text-emerald-800 mb-2">
                Потвърждение
              </h2>
              <div className="text-emerald-900">{successText}</div>

              <div className="mt-4 rounded-lg border border-emerald-200 bg-white/70 p-4 text-emerald-900">
                <div>
                  <strong>Адрес:</strong> София, ул. Проф. Христо Данов 19
                </div>
                <div>
                  <strong>Телефон:</strong>{" "}
                  <a
                    href="tel:0883688414"
                    className="underline decoration-emerald-500 hover:opacity-80"
                  >
                    0883 688 414
                  </a>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Link
                  href="https://dmphysi0.com"
                  className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                >
                  Назад към сайта
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // ----------------------

  const t = THERAPISTS[therapist];
  const isNoSixtyMinuteNote = Boolean(note && note.includes("60-"));

  if (!date) {
    return <div className="min-h-screen bg-white" />;
  }
  const selectedDateLabel = new Intl.DateTimeFormat("bg-BG", {
    day: "numeric",
    month: "long",
  }).format(date);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* РЕД: Календар + Часове */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* КАЛЕНДАР – голям панел */}
          <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
            <div className="p-4 flex-1">
              <h2 className="text-center text-[22px] font-semibold text-slate-900">
                Запазете час като изберете дата и час
              </h2>

              {date && <Calendar value={date} onChange={setDate} />}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200">
                  <h3 className="m-0 text-base font-semibold text-slate-900">
                    Изберете терапевт
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Снимка, име и работни часове за по-лесен избор.
                  </p>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(["any", "daniel", "elitsa"] as TherapistKey[]).map((key) => {
                    const active = therapist === key;
                    const item = THERAPISTS[key];
                    const firstFree = firstFreeByTherapist[key];
                    const firstFreeLabel = firstFreeLoading
                      ? `\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0437\u0430 \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u0438 \u0447\u0430\u0441\u043e\u0432\u0435 \u043d\u0430 ${selectedDateLabel}...`
                      : firstFree
                      ? `\u041f\u044a\u0440\u0432\u0438 \u0441\u0432\u043e\u0431\u043e\u0434\u0435\u043d: ${firstFree} \u043d\u0430 ${selectedDateLabel}`
                      : `\u041d\u044f\u043c\u0430 \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u0438 \u0447\u0430\u0441\u043e\u0432\u0435 \u043d\u0430 ${selectedDateLabel}`;
                    const subtitle =
                      key === "any"
                        ? "Избор по наличност"
                        : item.start && item.end
                        ? `Работно време: ${item.start}–${item.end}`
                        : "";

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleTherapistSelect(key)}
                        aria-pressed={active}
                        className={[
                          "relative rounded-xl border p-3 text-left transition",
                          "focus:outline-none focus:ring-2 focus:ring-blue-500",
                          active
                            ? "border-blue-600 bg-blue-50 shadow-md"
                            : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm",
                        ].join(" ")}
                      >
                        {active && (
                          <span className="absolute right-2 top-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Избран
                          </span>
                        )}

                        <div
                          className={
                            key === "any"
                              ? "flex min-h-16 items-center justify-center text-center"
                              : "flex items-center gap-3 sm:flex-col sm:text-center"
                          }
                        >
                          {key !== "any" && (
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                              {item.photo ? (
                                <Image
                                  src={item.photo}
                                  alt={item.name}
                                  width={64}
                                  height={64}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-600">
                                  {item.name.charAt(0)}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">
                              {item.name}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-600">
                              {subtitle}
                            </div>
                            <div
                              className={`mt-1 text-[11px] ${
                                !firstFreeLoading && !firstFree
                                  ? "text-red-600 font-semibold"
                                  : "text-slate-600"
                              }`}
                            >
                              {firstFreeLabel}
                            </div>

                            {active && key !== "any" && (
                              <div className="package-inline-card mt-3 overflow-hidden rounded-2xl border border-cyan-200/80 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-3 py-3 text-left text-white shadow-[0_16px_35px_rgba(14,116,144,0.18)]">
                                <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/8 px-3 py-3">
                                  <div>
                                    <div className="sr-only">
                                      Пакетна цена
                                    </div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-200/85">
                                      {PACKAGE_PRICE_LABEL}
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-white">
                                      5 x 1 час
                                    </div>
                                  </div>
                                  <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                                    {PACKAGE_PRICE_VALUE}
                                  </div>
                                </div>
                                <div className="mt-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] leading-5 text-slate-200">
                                  Пакетът се закупува на място и е с валидност 6 месеца.
                                </div>
                                <div className="sr-only">
                                  Показва се при избор на терапевт и представя пакетната цена.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {therapist !== "any" && (
                  <div className="px-4 pb-4">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                      Избран терапевт: <strong>{t.name}</strong>
                      {t.start && t.end ? ` • ${t.start}–${t.end}` : ""}
                    </div>
                  </div>
                )}
              </div>

              {/* ред: локация */}
              <div
                className="mt-4 flex items-center gap-2 text-xs text-slate-600"
                suppressHydrationWarning
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{mounted ? clientTz : ""}</span>
              </div>
            </div>
          </div>

          {/* ЧАСОВЕ – тесен панел */}
          <div ref={timesSectionRef} className="w-full md:w-[320px] shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col" style={{ scrollMarginTop: "calc(var(--tb-h, 64px) + 10px)" }}>
            <div className="px-4 pt-4">
              <div
                className="text-sm font-medium text-slate-900"
                suppressHydrationWarning
              >
                {date ? fmtDateHeader(date) : ""}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Налични часове
                </div>

                {/* Segmented control 30/60/90 */}
                <div className="inline-flex rounded-full border border-slate-300 bg-white p-1 shadow-sm">
                  <button
                    onClick={() => setDurationSafe(30)}
                    className={`px-3 h-8 rounded-full text-xs font-medium transition ${
                      duration === 30
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    aria-pressed={duration === 30}
                  >
                    30 мин
                  </button>

                  <button
                    onClick={() => hourAvailable && setDurationSafe(60)}
                    disabled={!hourAvailable}
                    className={`px-3 h-8 rounded-full text-xs font-medium transition ${
                      duration === 60
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                    } ${!hourAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={
                      !hourAvailable
                        ? "Няма свободен 60-мин интервал за тази дата"
                        : ""
                    }
                    aria-pressed={duration === 60}
                  >
                    60 мин
                  </button>

                  <button
                    onClick={() => ninetyAvailable && setDurationSafe(90)}
                    disabled={!ninetyAvailable}
                    className={`px-3 h-8 rounded-full text-xs font-medium transition ${
                      duration === 90
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                    } ${!ninetyAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={
                      !ninetyAvailable
                        ? "Няма свободен 90-мин интервал за тази дата"
                        : ""
                    }
                    aria-pressed={duration === 90}
                  >
                    90 мин
                  </button>
                </div>
              </div>

              {note && (
                <div
                  className={`mt-2 text-xs ${isNoSixtyMinuteNote ? "text-red-600 font-semibold" : "text-slate-500"}`}
                >
                  {note}
                </div>
              )}
            </div>

            {/* Списък с часове */}
            <div className="mt-3 p-4 pt-2 flex-1 min-h-0">
              {loading ? (
                <div className="text-sm text-slate-600">Зареждане…</div>
              ) : slots.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Няма свободни часове за този ден.
                </div>
              ) : (
                <div
                  ref={listRef}
                  className="ml-auto max-w-[260px] h-[348px] overflow-y-auto pr-1"
                >
                  <div className="flex flex-col gap-3">
                    {slots.map((s) => {
                      const selected = selectedTime === s.time;
                      const base =
                        "w-full h-12 flex items-center justify-between rounded-lg border px-3 text-sm transition";

                      if (!s.available) {
                        return (
                          <button
                            key={s.time}
                            disabled
                            className={`${base} cursor-not-allowed bg-white border-slate-200 text-slate-400`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-slate-300" />
                              {s.time}
                            </span>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={s.time}
                          onClick={() => setSelectedTime(s.time)}
                          className={
                            selected
                              ? `${base} bg-blue-600 border-blue-600 text-white`
                              : `${base} bg-white border-blue-200 text-blue-700 hover:bg-blue-50`
                          }
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                selected ? "bg-white" : "bg-emerald-500"
                              }`}
                            />
                            {s.time}
                          </span>
                          <span
                            className={`text-xs ${
                              selected ? "text-blue-100" : "text-blue-600"
                            }`}
                          >
                            запази
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

        {/* КОТВА за скрол към формата */}
        <div
          ref={formSectionRef}
          className="h-px"
          style={{ scrollMarginTop: "calc(var(--tb-h, 64px) + 10px)" }}
        />

        {/* ФОРМА */}
        {selectedTime && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-center text-[22px] font-semibold text-slate-900">
                Попълнете формата, за да запазите час
              </h2>
              <div className="mt-2 text-center text-sm text-slate-600">
                {date ? fmtDateHeader(date) : ""} • {selectedTime} • {duration}{" "}
                мин {therapist !== "any" ? `• ${t.name}` : ""}
              </div>
            </div>

            <form onSubmit={submit} className="p-6 space-y-4">
              <input type="hidden" name="therapist" value={therapist} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Име
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Вашето име"
                    required
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Фамилия
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Вашата фамилия"
                    required
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text_sm font-medium text-slate-700 mb-1">
                    Телефон
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0888 123 456"
                    required
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text_sm font-medium text-slate-700 mb-1">
                    Процедура
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Процедура / услуга"
                    required
                    value={form.procedure}
                    onChange={(e) =>
                      setForm({ ...form, procedure: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Имейл
                </label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Опишете симптомите си
                </label>
                <textarea
                  className="w-full min-h-[140px] rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Опишете болката, местоположение/разпространение, от кога, кое усилва/облекчава, предишни травми/изследвания, цел…"
                  value={form.symptoms || ""}
                  onChange={(e) =>
                    setForm({ ...form, symptoms: e.target.value })
                  }
                />
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="h-12 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Откажи
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 rounded-lg bg-gradient-to-r from-sky-500 to-emerald-500 text-white font-medium hover:opacity-95 disabled:opacity-60"
                >
                  {loading ? "Изпращане…" : "Запази"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
