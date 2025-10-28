import { NextRequest, NextResponse } from "next/server";
import { sendBookingEmailSMTP } from "@/app/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const env = process.env as Record<string, string | undefined>;
    const to = env.SMTP_USER!;
    if (!to) return NextResponse.json({ ok: false, error: "Missing SMTP_USER in env" }, { status: 500 });

    // Минимални фиктивни данни за мейла
    const now = new Date();
    const plus1h = new Date(now.getTime() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const toLocalISO = (d: Date, timeZone: string) => {
      const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      });
      const parts = fmt.formatToParts(d).reduce<Record<string,string>>((a,p)=>{ if(p.type!=="literal") a[p.type]=p.value; return a; },{});
      const tzDate = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
      const offsetMs = tzDate.getTime() - d.getTime();
      const sign = offsetMs >= 0 ? "+" : "-";
      const abs = Math.abs(offsetMs);
      const offH = pad(Math.floor(abs / 3_600_000));
      const offM = pad(Math.floor((abs % 3_600_000) / 60_000));
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${offH}:${offM}`;
    };
    const tzid = "Europe/Sofia";
    const startISO = toLocalISO(now, tzid);
    const endISO = toLocalISO(plus1h, tzid);

    await sendBookingEmailSMTP({
      to,
      from: env.EMAIL_FROM || to,
      subject: "Тест: DM PHYSIO SMTP",
      firstName: "Тест",
      lastName: "Имейл",
      dateText: new Intl.DateTimeFormat("bg-BG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tzid }).format(now),
      timeText: `${new Intl.DateTimeFormat("bg-BG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tzid }).format(now)}–${new Intl.DateTimeFormat("bg-BG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tzid }).format(plus1h)} (60 мин)`,
      therapist: "Тест терапевт",
      procedure: "Тест процедура",
      phone: "0883688414",
      address: "София, ул. Проф. Христо Данов 19",
      notes: "Тест бележки",
      startISO,
      endISO,
      tzid,
    });

    return NextResponse.json({ ok: true, to });
  } catch (e: any) {
    console.error("[DEBUG-EMAIL] FAILED:", e?.message ?? e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
