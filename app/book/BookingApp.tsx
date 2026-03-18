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
  any: { name: "Р‘РµР· Р·РЅР°С‡РµРЅРёРµ" },
  daniel: {
    name: "Р”Р°РЅРёРµР» РњРёС‚РµРІ",
    photo: "/therapists/daniel.jpg",
    start: "13:00",
    end: "19:00",
  },
  elitsa: {
    name: "Р•Р»РёС†Р° РљРѕР»РµРІР°",
    photo: "/therapists/elitsa.jpg",
    start: "09:00",
    end: "13:00",
  },
};

// helpers
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BookingApp() {
  // Р±Р°Р·РѕРІРё СЃСЉСЃС‚РѕСЏРЅРёСЏ (РёРЅРёС†РёР°Р»РёР·РёСЂР° СЃРµ СЃР°РјРѕ РЅР° РєР»РёРµРЅС‚Р°)
  const [date, setDate] = React.useState<Date | null>(null);
  const [duration, setDuration] = React.useState<30 | 60 | 90>(60);
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = React.useState<string | null>(null);

  // С‚РµСЂР°РїРµРІС‚
  const [therapist, setTherapist] = React.useState<TherapistKey>("any");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successText, setSuccessText] = React.useState<string | null>(null);

  // Р»РѕРіРёРєР° 60/90
  const [hourAvailable, setHourAvailable] = React.useState(true);
  const [ninetyAvailable, setNinetyAvailable] = React.useState(true);
  const [note, setNote] = React.useState<string | null>(null);

  // С„РѕСЂРјР°
  const [form, setForm] = React.useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    procedure: "",
    symptoms: "",
  });

  // СЃРєСЂРѕР»
  const listRef = React.useRef<HTMLDivElement>(null);
  const formSectionRef = React.useRef<HTMLDivElement | null>(null);

  // timezone
  const [mounted, setMounted] = React.useState(false);
  const [clientTz, setClientTz] = React.useState<string>("");

  React.useEffect(() => {
    setMounted(true);
    setClientTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РЅР° РґР°С‚Р°С‚Р° СЃР°РјРѕ РЅР° РєР»РёРµРЅС‚Р°
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

  // Р·Р°СЂРµР¶РґР°РЅРµ РЅР° СЃР»РѕС‚РѕРІРµС‚Рµ (РІРєР». therapist)
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
        if (!anyHour) setNote("РќСЏРјР° СЃРІРѕР±РѕРґРµРЅ 60-РјРёРЅ РёРЅС‚РµСЂРІР°Р» Р·Р° С‚Р°Р·Рё РґР°С‚Р°.");
      } else if (duration === 90) {
        const any90 = list.some((s) => s.available);
        setNinetyAvailable(any90);
        if (!any90) setNote("РќСЏРјР° СЃРІРѕР±РѕРґРµРЅ 90-РјРёРЅ РёРЅС‚РµСЂРІР°Р» Р·Р° С‚Р°Р·Рё РґР°С‚Р°.");
      } else {
        setHourAvailable(true);
        setNinetyAvailable(true);
      }

      setSlots(list);
    } catch (e: unknown) {
      setSlots([]);
      setError(e instanceof Error ? e.message : "Р“СЂРµС€РєР° РїСЂРё Р·Р°СЂРµР¶РґР°РЅРµ.");
    } finally {
      setLoading(false);
    }
  }, [date, duration, therapist]);

  React.useEffect(() => {
    if (date) void load();
  }, [date, load]);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [date, duration, therapist]);

  React.useEffect(() => {
    setSelectedTime(null);
    setNote(null);
  }, [date, therapist]);

  // РїР»Р°РІРµРЅ СЃРєСЂРѕР» РєСЉРј С„РѕСЂРјР°С‚Р°
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
      setError("РњРѕР»СЏ, РёР·Р±РµСЂРµС‚Рµ С‡Р°СЃ.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const body = {
        date: ymd(date),
        time: selectedTime,
        duration,
        therapist, // в†ђ РєСЉРј API
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
        throw new Error(data?.error || `Р“СЂРµС€РєР° РїСЂРё Р·Р°РїРёСЃ (HTTP ${res.status}).`);
      }

      // СѓСЃРїРµС…
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
        `РЈСЃРїРµС€РЅРѕ Р·Р°РїР°Р·РёС…С‚Рµ С‡Р°СЃ! ${fmtDateHeader(
          date
        )} вЂў ${toHHMM(start)}вЂ“${toHHMM(end)} (${duration} РјРёРЅ)` +
          (therapist !== "any" ? ` вЂў РўРµСЂР°РїРµРІС‚: ${tName}` : "")
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
      setError(e instanceof Error ? e.message : "Р“СЂРµС€РєР° РїСЂРё Р·Р°РїРёСЃ.");
    } finally {
      setLoading(false);
    }
  }

  // --- РџРѕС‚РІСЉСЂР¶РґРµРЅРёРµ ---
  if (successText) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm">
            <div className="px-6 py-6">
              <h2 className="text-xl font-semibold text-emerald-800 mb-2">
                РџРѕС‚РІСЉСЂР¶РґРµРЅРёРµ
              </h2>
              <div className="text-emerald-900">{successText}</div>

              <div className="mt-4 rounded-lg border border-emerald-200 bg-white/70 p-4 text-emerald-900">
                <div>
                  <strong>РђРґСЂРµСЃ:</strong> РЎРѕС„РёСЏ, СѓР». РџСЂРѕС„. РҐСЂРёСЃС‚Рѕ Р”Р°РЅРѕРІ 19
                </div>
                <div>
                  <strong>РўРµР»РµС„РѕРЅ:</strong>{" "}
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
                  РќР°Р·Р°Рґ РєСЉРј СЃР°Р№С‚Р°
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

  if (!date) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Р Р•Р”: РљР°Р»РµРЅРґР°СЂ + Р§Р°СЃРѕРІРµ */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* РљРђР›Р•РќР”РђР  вЂ“ РіРѕР»СЏРј РїР°РЅРµР» */}
          <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
            <div className="p-4 flex-1">
              <h2 className="text-center text-[22px] font-semibold text-slate-900">
                Р—Р°РїР°Р·РµС‚Рµ С‡Р°СЃ РєР°С‚Рѕ РёР·Р±РµСЂРµС‚Рµ РґР°С‚Р° Рё С‡Р°СЃ
              </h2>

              {date && <Calendar value={date} onChange={setDate} />}

              {/* рџ”Ѕ РџР РћР—РћР Р•Р¦: РР·Р±РµСЂРµС‚Рµ С‚РµСЂР°РїРµРІС‚ */}
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
                        onClick={() => setTherapist(key)}
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

                        <div className="flex items-center gap-3 sm:flex-col sm:text-center">
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
                                DM
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">
                              {item.name}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-600">
                              {subtitle}
                            </div>
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
              <div
                className="mt-4 flex items-center gap-2 text-xs text-slate-600"
                suppressHydrationWarning
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{mounted ? clientTz : ""}</span>
              </div>
            </div>
          </div>

          {/* Р§РђРЎРћР’Р• вЂ“ С‚РµСЃРµРЅ РїР°РЅРµР» */}
          <div className="w-full md:w-[320px] shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
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
                  РќР°Р»РёС‡РЅРё С‡Р°СЃРѕРІРµ
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
                    30 РјРёРЅ
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
                        ? "РќСЏРјР° СЃРІРѕР±РѕРґРµРЅ 60-РјРёРЅ РёРЅС‚РµСЂРІР°Р» Р·Р° С‚Р°Р·Рё РґР°С‚Р°"
                        : ""
                    }
                    aria-pressed={duration === 60}
                  >
                    60 РјРёРЅ
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
                        ? "РќСЏРјР° СЃРІРѕР±РѕРґРµРЅ 90-РјРёРЅ РёРЅС‚РµСЂРІР°Р» Р·Р° С‚Р°Р·Рё РґР°С‚Р°"
                        : ""
                    }
                    aria-pressed={duration === 90}
                  >
                    90 РјРёРЅ
                  </button>
                </div>
              </div>

              {note && <div className="mt-2 text-xs text-slate-500">{note}</div>}
            </div>

            {/* РЎРїРёСЃСЉРє СЃ С‡Р°СЃРѕРІРµ */}
            <div className="mt-3 p-4 pt-2 flex-1 min-h-0">
              {loading ? (
                <div className="text-sm text-slate-600">Р—Р°СЂРµР¶РґР°РЅРµвЂ¦</div>
              ) : slots.length === 0 ? (
                <div className="text-sm text-slate-500">
                  РќСЏРјР° СЃРІРѕР±РѕРґРЅРё С‡Р°СЃРѕРІРµ Р·Р° С‚РѕР·Рё РґРµРЅ.
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
                            Р·Р°РїР°Р·Рё
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

        {/* РљРћРўР’Рђ Р·Р° СЃРєСЂРѕР» РєСЉРј С„РѕСЂРјР°С‚Р° */}
        <div
          ref={formSectionRef}
          className="h-px"
          style={{ scrollMarginTop: "calc(var(--tb-h, 64px) + 10px)" }}
        />

        {/* Р¤РћР РњРђ */}
        {selectedTime && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-center text-[22px] font-semibold text-slate-900">
                РџРѕРїСЉР»РЅРµС‚Рµ С„РѕСЂРјР°С‚Р°, Р·Р° РґР° Р·Р°РїР°Р·РёС‚Рµ С‡Р°СЃ
              </h2>
              <div className="mt-2 text-center text-sm text-slate-600">
                {date ? fmtDateHeader(date) : ""} вЂў {selectedTime} вЂў {duration}{" "}
                РјРёРЅ {therapist !== "any" ? `вЂў ${t.name}` : ""}
              </div>
            </div>

            <form onSubmit={submit} className="p-6 space-y-4">
              <input type="hidden" name="therapist" value={therapist} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    РРјРµ
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Р’Р°С€РµС‚Рѕ РёРјРµ"
                    required
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Р¤Р°РјРёР»РёСЏ
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Р’Р°С€Р°С‚Р° С„Р°РјРёР»РёСЏ"
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
                    РўРµР»РµС„РѕРЅ
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
                    РџСЂРѕС†РµРґСѓСЂР°
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="РџСЂРѕС†РµРґСѓСЂР° / СѓСЃР»СѓРіР°"
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
                  РРјРµР№Р»
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
                  РћРїРёС€РµС‚Рµ СЃРёРјРїС‚РѕРјРёС‚Рµ СЃРё
                </label>
                <textarea
                  className="w-full min-h-[140px] rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="РћРїРёС€РµС‚Рµ Р±РѕР»РєР°С‚Р°, РјРµСЃС‚РѕРїРѕР»РѕР¶РµРЅРёРµ/СЂР°Р·РїСЂРѕСЃС‚СЂР°РЅРµРЅРёРµ, РѕС‚ РєРѕРіР°, РєРѕРµ СѓСЃРёР»РІР°/РѕР±Р»РµРєС‡Р°РІР°, РїСЂРµРґРёС€РЅРё С‚СЂР°РІРјРё/РёР·СЃР»РµРґРІР°РЅРёСЏ, С†РµР»вЂ¦"
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
                  РћС‚РєР°Р¶Рё
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 rounded-lg bg-gradient-to-r from-sky-500 to-emerald-500 text-white font-medium hover:opacity-95 disabled:opacity-60"
                >
                  {loading ? "РР·РїСЂР°С‰Р°РЅРµвЂ¦" : "Р—Р°РїР°Р·Рё"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

