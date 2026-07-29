"use client";

import * as React from "react";
import {
  addDays,
  isSameDay,
  startOfWeek,
  startOfDay,
  format,
} from "date-fns";
import { bg as bgLocale, enGB as enLocale } from "date-fns/locale";

export type CalendarLocale = "bg" | "en";

type Props = {
  value: Date;
  onChange: (d: Date) => void;
  locale?: CalendarLocale;
  unavailableDates?: string[];
  onRangeChange?: (start: string, days: number) => void;
};

const DAYS_PER_PAGE = 28;

function getDateFnsLocale(locale: CalendarLocale) {
  return locale === "en" ? enLocale : bgLocale;
}

export default function Calendar({
  value,
  onChange,
  locale = "bg",
  unavailableDates = [],
  onRangeChange,
}: Props) {
  const today = startOfDay(new Date());
  const firstRangeStart = startOfWeek(today, { weekStartsOn: 1 });
  const [rangeStart, setRangeStart] = React.useState<Date>(firstRangeStart);
  const unavailableDateSet = React.useMemo(
    () => new Set(unavailableDates),
    [unavailableDates]
  );
  const activeLocale = getDateFnsLocale(locale);
  const labels = locale === "en"
    ? {
        unavailable: "No available times",
        previous: "Previous 4 weeks",
        next: "Next 4 weeks",
        today: "Today",
      }
    : {
        unavailable: "Няма свободни часове",
        previous: "Предишни 4 седмици",
        next: "Следващи 4 седмици",
        today: "Днес",
      };

  const minDate = startOfDay(today);
  const maxDate = startOfDay(addDays(today, 364));
  const rangeEnd = addDays(rangeStart, DAYS_PER_PAGE - 1);
  const isFirstRange = rangeStart.getTime() === firstRangeStart.getTime();
  const isLastRange = rangeEnd >= maxDate;

  React.useEffect(() => {
    onRangeChange?.(format(rangeStart, "yyyy-MM-dd"), DAYS_PER_PAGE);
  }, [onRangeChange, rangeStart]);

  function showPreviousRange() {
    const previous = addDays(rangeStart, -DAYS_PER_PAGE);
    setRangeStart(previous < firstRangeStart ? firstRangeStart : previous);
  }

  function showNextRange() {
    if (isLastRange) return;
    setRangeStart(addDays(rangeStart, DAYS_PER_PAGE));
  }

  function renderHeader() {
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={showPreviousRange}
            disabled={isFirstRange}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={labels.previous}
          >
            ‹
          </button>
          <div className="text-center font-medium text-slate-900">
            {format(rangeStart, "d MMMM", { locale: activeLocale })} –{" "}
            {format(rangeEnd, "d MMMM yyyy", { locale: activeLocale })}
          </div>
          <button
            type="button"
            onClick={showNextRange}
            disabled={isLastRange}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={labels.next}
          >
            ›
          </button>
        </div>
        {!isFirstRange ? (
          <button
            type="button"
            onClick={() => setRangeStart(firstRangeStart)}
            className="mx-auto mt-2 block text-xs font-medium text-teal-700 hover:text-teal-900"
          >
            {labels.today}
          </button>
        ) : null}
      </div>
    );
  }

  function renderDaysOfWeek() {
    return (
      <div className="grid grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => {
          const d = addDays(rangeStart, i);
          return <div key={i} className="text-xs font-medium text-slate-500 text-center py-1 select-none">{format(d, "EEEEE", { locale: activeLocale }).toUpperCase()}</div>;
        })}
      </div>
    );
  }

  function renderCells() {
    const rows: React.ReactNode[] = [];
    let dayIndex = 0;

    while (dayIndex < DAYS_PER_PAGE) {
      const cells: React.ReactNode[] = [];
      for (let i = 0; i < 7; i++) {
        const clone = addDays(rangeStart, dayIndex);
        const disabled = clone < minDate || clone > maxDate || clone.getDay() === 0;
        const selected = isSameDay(clone, value);
        const unavailable =
          clone >= minDate &&
          clone.getDay() !== 0 &&
          unavailableDateSet.has(format(clone, "yyyy-MM-dd"));
        cells.push(
          <button
            key={clone.toISOString()}
            type="button"
            disabled={disabled || unavailable}
            onClick={() => onChange(clone)}
            className={[
              "relative flex h-10 w-full items-center justify-center rounded-lg border text-sm transition",
              disabled && !unavailable ? "text-slate-300 cursor-not-allowed" : "",
              !disabled && !unavailable
                ? "border-transparent text-slate-800 hover:bg-slate-100"
                : "",
              selected && !unavailable
                ? "border-black bg-black text-white hover:bg-black"
                : "",
              unavailable
                ? "cursor-not-allowed border-rose-200 bg-rose-50 text-slate-400"
                : "",
            ].join(" ")}
            title={`${format(clone, "PPP", { locale: activeLocale })}${
              unavailable ? ` - ${labels.unavailable}` : ""
            }`}
          >
            <span>{format(clone, "d", { locale: activeLocale })}</span>
            {unavailable ? (
              <span
                className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-rose-500"
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
        dayIndex += 1;
      }
      rows.push(<div key={dayIndex} className="grid grid-cols-7 gap-1">{cells}</div>);
    }
    return <div className="mt-2 space-y-1">{rows}</div>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {renderHeader()}
      {renderDaysOfWeek()}
      {renderCells()}
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
        <span>{labels.unavailable}</span>
      </div>
    </div>
  );
}
