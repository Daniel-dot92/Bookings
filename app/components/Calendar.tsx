// app/components/Calendar.tsx
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
import { bg as bgLocale } from "date-fns/locale";

type Props = {
  value: Date;
  onChange: (d: Date) => void;
};

export default function Calendar({ value, onChange }: Props) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(value);

  React.useEffect(() => setCurrentMonth(value), [value]);

  // Ограничения
  const today = startOfDay(new Date());
  const minDate = startOfDay(addDays(today, 1));   // от утре
  const maxDate = startOfDay(addDays(today, 21));  // +3 седмици

  function renderHeader() {
    return (
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="h-8 w-8 rounded-full border border-slate-300 hover:bg-slate-50 flex items-center justify-center"
          aria-label="Предишен месец"
        >
          ‹
        </button>
        <div className="text-slate-900 font-medium">
          {format(currentMonth, "LLLL yyyy", { locale: bgLocale })}
        </div>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="h-8 w-8 rounded-full border border-slate-300 hover:bg-slate-50 flex items-center justify-center"
          aria-label="Следващ месец"
        >
          ›
        </button>
      </div>
    );
  }

  function renderDaysOfWeek() {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return (
      <div className="grid grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => {
          const d = addDaysDF(start, i);
          return (
            <div
              key={i}
              className="text-xs font-medium text-slate-500 text-center py-1 select-none"
            >
              {format(d, "EEEEE", { locale: bgLocale }).toUpperCase()}
            </div>
          );
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

// ↓ неразрешени: преди утре, след +21 дни и НЕДЕЛЯ
const tooEarly = clone < minDate;
const tooLate = clone > maxDate;
const isSunday = clone.getDay() === 0; // 0 = неделя

const disabled = out || tooEarly || tooLate || isSunday;


        const selected = isSameDay(clone, value);

        cells.push(
          <button
            key={clone.toISOString()}
            type="button"
            disabled={disabled}
            onClick={() => onChange(clone)}
            className={[
              "h-10 w-full flex items-center justify-center rounded-lg text-sm transition",
              disabled
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-800 hover:bg-slate-100",
              selected ? "bg-black text-white hover:bg-black" : "",
            ].join(" ")}
            title={format(clone, "PPP", { locale: bgLocale })}
          >
            {format(clone, "d", { locale: bgLocale })}
          </button>
        );

        day = addDaysDF(day, 1);
      }

      rows.push(
        <div key={day.toISOString()} className="grid grid-cols-7 gap-1">
          {cells}
        </div>
      );
    }

    return <div className="mt-2 space-y-1">{rows}</div>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {renderHeader()}
      {renderDaysOfWeek()}
      {renderCells()}
    </div>
  );
}
