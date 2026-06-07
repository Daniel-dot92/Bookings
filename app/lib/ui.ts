// app/lib/ui.ts
export type UiLocale = "bg" | "en";

export function fmtDateHeader(d: Date, locale: UiLocale = "bg") {
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "bg-BG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
