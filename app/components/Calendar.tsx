"use client";

import * as React from "react";
import {
  addDays,
  subMonths,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays as addDaysDF,
  isSameMonth,
  isSameDay,
  startOfDay,
  format,
} from "date-fns";
import { bg as bgLocale, enGB as enLocale } from "date-fns/locale";

export type CalendarLocale = "bg" | "en";

type Props = {
  value: Date;
  onChange: (d: Date) => void;
  locale?: CalendarLocale;
};

function getDateFnsLocale(locale: CalendarLocale) {
  return locale === "en" ? enLocale : bgLocale;
}

export default function Calendar({ value, onChange, locale = "bg" }: Props) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(value);
  const activeLocale = getDateFnsLocale(locale);
  const labels = locale === "en"
    ? { previousMonth: "Previous month", nextMonth: "Next month" }
    : { previousMonth: "Предишен месец", nextMonth: "Следващ месец" };

  React.useEffect(() => setCurrentMonth(value), [value]);

  const today = startOfDay(new Date());
  const minDate = startOfDay(today);
  const maxDate = startOfDay(addDays(today, 21));

  function renderHeader() {
    return (
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="h-8 w-8 rounded-full border border-slate-300 hover:bg-slate-50 flex items-center justify-center" aria-label={labels.previousMonth}>‹</button>
        <div className="text-slate-900 font-medium">{format(currentMonth, "LLLL yyyy", { locale: activeLocale })}</div>
        <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="h-8 w-8 rounded-full border border-slate-300 hover:bg-slate-50 flex items-center justify-center" aria-label={labels.nextMonth}>›</button>
      </div>
    );
  }

  function renderDaysOfWeek() {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return (
      <div className="grid grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => {
          const d = addDaysDF(start, i);
          return <div key={i} className="text-xs font-medium text-slate-500 text-center py-1 select-none">{format(d, "EEEEE", { locale: activeLocale }).toUpperCase()}</div>;
        })}
      </div>
    );
  }

  function renderCells() {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const rows: React.ReactNode[] = [];
    let day = gridStart;

    while (day <= gridEnd) {
      const cells: React.ReactNode[] = [];
      for (let i = 0; i < 7; i++) {
        const clone = day;
        const out = !isSameMonth(clone, monthStart);
        const disabled = clone < minDate || clone > maxDate || clone.getDay() === 0;
        const selected = isSameDay(clone, value);
        cells.push(
          <button
            key={clone.toISOString()}
            type="button"
            disabled={disabled}
            onClick={() => onChange(clone)}
            className={[
              "h-10 w-full flex items-center justify-center rounded-lg text-sm transition",
              disabled ? "text-slate-300 cursor-not-allowed" : "text-slate-800 hover:bg-slate-100",
              selected ? "bg-black text-white hover:bg-black" : "",
              !selected && !disabled && out ? "text-slate-400" : "",
            ].join(" ")}
            title={format(clone, "PPP", { locale: activeLocale })}
          >
            {format(clone, "d", { locale: activeLocale })}
          </button>
        );
        day = addDaysDF(day, 1);
      }
      rows.push(<div key={day.toISOString()} className="grid grid-cols-7 gap-1">{cells}</div>);
    }
    return <div className="mt-2 space-y-1">{rows}</div>;
  }

  return <div className="rounded-xl border border-slate-200 bg-white p-3">{renderHeader()}{renderDaysOfWeek()}{renderCells()}</div>;
}
