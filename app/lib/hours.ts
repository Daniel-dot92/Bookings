// app/lib/hours.ts
export const WORKING_HOURS: Record<number, { start: string; end: string } | null> = {
  // 0=Неделя ... 6=Събота
  0: null,                           // Неделя – почивен
  1: { start: '09:00', end: '19:00' },
  2: { start: '09:00', end: '19:00' },
  3: { start: '09:00', end: '19:00' },
  4: { start: '09:00', end: '19:00' },
  5: { start: '09:00', end: '19:00' },
  6: { start: '10:00', end: '16:00' }, // Събота
};
