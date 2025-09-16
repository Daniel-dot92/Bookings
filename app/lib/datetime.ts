// app/lib/datetime.ts
import { addMinutes, isBefore } from 'date-fns';

const TZ = 'Europe/Sofia';

/**
 * Връща отместването (в ms) на дадена timeZone спрямо UTC за конкретен момент
 */
function getTimeZoneOffset(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value || '0');

  const asIfLocalUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );

  return asIfLocalUTC - date.getTime();
}

/**
 * Превръща дата + час (локално за София) в правилен UTC Date
 * Пример: 2025-09-17 12:00 (София, UTC+3) → 2025-09-17T09:00:00.000Z
 */
export function parseZoned(dateStr: string, timeStr: string) {
  const [Y, M, D] = dateStr.split('-').map(Number);
  const [h, m]   = timeStr.split(':').map(Number);

  const naiveUtcTs = Date.UTC(Y, (M - 1), D, h, m, 0);
  const offset = getTimeZoneOffset(new Date(naiveUtcTs), TZ);

  return new Date(naiveUtcTs - offset);
}

/** Дава началото и края на деня в UTC */
export function dayBounds(dateStr: string) {
  const start = parseZoned(dateStr, '00:00');
  const end = parseZoned(dateStr, '23:59');
  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

/** Генерира часови слотове (по 30 мин или друга стъпка) */
export function* generateSlots(
  dateStr: string,
  startHHMM: string,
  endHHMM: string,
  stepMin = 30,
) {
  let cur = parseZoned(dateStr, startHHMM);
  const end = parseZoned(dateStr, endHHMM);
  while (isBefore(cur, end)) {
    yield cur;
    cur = addMinutes(cur, stepMin);
  }
}

/** Форматира дата като HH:mm в Europe/Sofia */
const hhmmFmt = new Intl.DateTimeFormat('bg-BG', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
});
export function fmtHHmmLocal(d: Date) {
  return hhmmFmt.format(d);
}
