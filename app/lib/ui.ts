// app/lib/ui.ts
export function fmtDateHeader(d: Date) {
  // Пример: "вторник, 16 септември 2025 г."
  return d.toLocaleDateString("bg-BG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
