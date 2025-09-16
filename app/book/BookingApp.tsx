// app/book/BookingApp.tsx
"use client";

import * as React from "react";
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

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// помощни за диапазона (от утре до +21 дни)
function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
const todayStart = startOfDayLocal(new Date());
const minDate = new Date(todayStart); // утре 00:00
minDate.setDate(minDate.getDate() + 1);
const maxDate = new Date(minDate); // +21 дни напред
maxDate.setDate(maxDate.getDate() + 21);
function isInAllowedRange(d: Date) {
  const s = startOfDayLocal(d);
  return s >= minDate && s <= maxDate;
}

export default function BookingApp() {
  const [date, setDate] = React.useState(new Date());
  const [duration, setDuration] = React.useState<30 | 60>(30);
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [hourAvailable, setHourAvailable] = React.useState(true);
  const [note, setNote] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    procedure: "",
    symptoms: "",
  });

  // контейнерът със скрол за часовете
  const listRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    // не нулираме избрания час тук, за да не изчезва формата, ако има
    try {
      // ако датата е извън позволения диапазон – не зареждаме
      if (!isInAllowedRange(date)) {
        setSlots([]);
        setHourAvailable(true);
        setNote("Записването е позволено от утре до 3 седмици напред.");
        return;
      } else {
        setNote(null);
      }

      const d = ymd(date);
      const res = await fetch(`/api/availability?date=${d}&duration=${duration}`);
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const json = (await res.json()) as { slots?: Slot[] };
      const list = Array.isArray(json.slots) ? json.slots : [];

      if (duration === 60) {
        const anyHour = list.some((s) => s.available);
        if (!anyHour) {
          setHourAvailable(false);
          setNote("Няма свободен цял час за тази дата. Показваме опции по 30 мин.");
          setDuration(30);
          setSlots([]);
          return;
        }
        setHourAvailable(true);
      } else {
        setHourAvailable(true);
      }

      setSlots(list);
    } catch (e: unknown) {
      setSlots([]);
      setError(e instanceof Error ? e.message : "Грешка при зареждане.");
    } finally {
      setLoading(false);
    }
  }, [date, duration]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // При смяна на дата/продължителност – връщаме скрола най-горе
  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [date, duration]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTime) {
      setError("Моля, изберете час.");
      return;
    }

    // клиентска защита – ако датата е извън диапазона
    if (!isInAllowedRange(date)) {
      setError("Може да записвате от утре до 3 седмици напред.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: ymd(date), time: selectedTime, duration, ...form }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Грешка при запис.");
      setSuccess("Успешно записахте час!");
      setSelectedTime(null);
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        procedure: "",
        symptoms: "",
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка при запис.");
    } finally {
      setLoading(false);
    }
  }

  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* РЕД: Календар + Часове */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* КАЛЕНДАР – голям панел */}
          <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
            <div className="p-4 flex-1">
              <h2 className="text-center text-[22px] font-semibold text-slate-900">
                Запази час сега
              </h2>
              <Calendar value={date} onChange={setDate} />
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {tzName}
              </div>
            </div>
          </div>

          {/* ЧАСОВЕ – тесен панел, залепен вдясно */}
          <div className="w-full md:w-[320px] shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
            <div className="px-4 pt-4">
              <div className="text-sm font-medium text-slate-900">{fmtDateHeader(date)}</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Налични часове
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setDuration(30)}
                    className={`h-7 px-3 rounded-full border text-xs ${
                      duration === 30
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    30 мин
                  </button>
                  <button
                    onClick={() => hourAvailable && setDuration(60)}
                    disabled={!hourAvailable}
                    className={`h-7 px-3 rounded-full border text-xs ${
                      duration === 60
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                    } ${!hourAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={!hourAvailable ? "Няма свободен 60-мин интервал за тази дата" : ""}
                  >
                    60 мин
                  </button>
                </div>
              </div>
              {note && <div className="mt-2 text-xs text-slate-500">{note}</div>}
            </div>

            {/* Списък с часове – 6 видими, вертикален скрол */}
            <div className="mt-3 p-4 pt-2 flex-1 min-h-0">
              {loading ? (
                <div className="text-sm text-slate-600">Зареждане…</div>
              ) : slots.length === 0 ? (
                <div className="text-sm text-slate-500">Няма свободни часове за този ден.</div>
              ) : (
                <div ref={listRef} className="ml-auto max-w-[260px] h-[348px] overflow-y-auto pr-1">
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
                          <span className={`text-xs ${selected ? "text-blue-100" : "text-blue-600"}`}>
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

        {/* ТРЕТИ ПАНЕЛ – ФОРМАТА под двата панела */}
        {selectedTime && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-center text-[22px] font-semibold text-slate-900">
                Попълнете формата, за да запазите час
              </h2>
              <div className="mt-2 text-center text-sm text-slate-600">
                {fmtDateHeader(date)} • {selectedTime} • {duration} мин
              </div>
            </div>

            <form onSubmit={submit} className="p-6 space-y-4">
              {/* Име + Фамилия */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Име</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Вашето име"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Фамилия</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Вашата фамилия"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
              </div>

              {/* Телефон + Процедура */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0888 123 456"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Процедура</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Процедура / услуга"
                    required
                    value={form.procedure}
                    onChange={(e) => setForm({ ...form, procedure: e.target.value })}
                  />
                </div>
              </div>

              {/* Имейл */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Имейл</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              {/* Симптоми */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Опишете симптомите си
                </label>
                <textarea
                  className="w-full min-h-[140px] rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Опишете болката, местоположение/разпространение, от кога, кое усилва/облекчава, предишни травми/изследвания, цел…"
                  value={form.symptoms || ""}
                  onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                />
              </div>

              {/* Съобщения */}
              {error && <div className="text-sm text-red-600">{error}</div>}
              {success && <div className="text-sm text-emerald-600">{success}</div>}

              {/* Бутон */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 rounded-lg bg-gradient-to-r from-sky-500 to-emerald-500 text-white font-medium object-aligh center hover:opacity-95 disabled:opacity-60 "
                >
                  {loading ? "Записване…" : "Запази"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
