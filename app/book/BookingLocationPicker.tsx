import Image from "next/image";
import Link from "next/link";
import {
  type BookingLocale,
  type OfficeKey,
  getOfficeDefinition,
  getOfficeTherapists,
} from "@/app/lib/booking-config";

const OFFICE_LINKS: Record<OfficeKey, string> = {
  "studentski-grad": "/book/hristo-danov",
  "mladost-1a": "/book/mladost",
};

const OFFICE_ORDER: OfficeKey[] = ["studentski-grad", "mladost-1a"];

function formatRating(locale: BookingLocale, rating: number) {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating);
}

export default function BookingLocationPicker({ locale }: { locale: BookingLocale }) {
  const isEn = locale === "en";

  return (
    <main className="min-h-[calc(100vh-var(--tb-h,64px))] bg-[radial-gradient(circle_at_top_left,_rgba(14,124,134,0.12),_transparent_32%),linear-gradient(180deg,#f4fbfc_0%,#ffffff_70%)] px-3 py-6 text-slate-900 sm:px-5 md:py-10">
      <section className="mx-auto max-w-6xl">
        <div className="mb-5 md:mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
            DM Physio
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            {isEn ? "Choose a studio" : "Изберете обект"}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-6">
          {OFFICE_ORDER.map((key) => {
            const office = getOfficeDefinition(key);
            const officeCopy = office.copy[locale];
            const href = isEn ? `/en${OFFICE_LINKS[key]}` : OFFICE_LINKS[key];
            const therapistCount = getOfficeTherapists(key).length;

            return (
              <article
                key={key}
                className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.07)] transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_22px_55px_rgba(14,124,134,0.14)] md:rounded-[30px]"
              >
                <Link href={href} className="block focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300">
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    {office.photo && (
                      <Image
                        src={office.photo}
                        alt={`${officeCopy.name} - ${officeCopy.address}`}
                        fill
                        sizes="(max-width: 767px) 50vw, 560px"
                        className="object-cover transition duration-500 group-hover:scale-[1.025]"
                        priority={key === "studentski-grad"}
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/65 to-transparent" />
                    <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-800 shadow-sm sm:text-xs md:bottom-4 md:left-4 md:px-3">
                      {isEn ? "Book here" : "Запази тук"}
                    </span>
                  </div>

                  <div className="p-3 sm:p-4 md:p-5">
                    <h2 className="text-base font-semibold leading-tight text-slate-950 sm:text-xl md:text-2xl">
                      {officeCopy.district}
                    </h2>
                    <p className="mt-1 min-h-10 text-xs leading-5 text-slate-600 sm:text-sm">
                      {officeCopy.shortAddress}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold sm:gap-2 sm:text-xs">
                      {office.reviewStatus ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-amber-800 sm:px-3 sm:py-1.5">
                          {office.reviewStatus[locale]}
                        </span>
                      ) : office.googleRating && office.googleReviewCount ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2 py-1 text-white sm:px-3 sm:py-1.5">
                          <span className="text-amber-300" aria-hidden="true">★</span>
                          {formatRating(locale, office.googleRating)}
                          <span className="hidden text-white/70 sm:inline">
                            · {office.googleReviewCount} {isEn ? "reviews" : "ревюта"}
                          </span>
                        </span>
                      ) : null}
                      <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-800 sm:px-3 sm:py-1.5">
                        {therapistCount} {therapistCount === 1 ? (isEn ? "therapist" : "терапевт") : (isEn ? "therapists" : "терапевти")}
                      </span>
                    </div>

                    <span className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-teal-700 px-3 text-xs font-bold text-white transition group-hover:bg-teal-800 sm:text-sm md:h-11">
                      {isEn ? "View available times" : "Виж свободните часове"}
                    </span>
                  </div>
                </Link>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3 pt-2 sm:p-4 sm:pt-3">
                  <a
                    href={office.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-300 px-2 text-center text-[10px] font-semibold text-slate-700 hover:bg-slate-50 sm:text-xs"
                  >
                    Google Maps
                  </a>
                  {office.reviewStatus ? (
                    <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-2 text-center text-[10px] font-semibold text-amber-800 sm:text-xs">
                      {office.reviewStatus[locale]}
                    </span>
                  ) : office.reviewsUrl ? (
                    <a
                      href={office.reviewsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-9 items-center justify-center rounded-full border border-teal-200 bg-teal-50 px-2 text-center text-[10px] font-semibold text-teal-800 hover:bg-teal-100 sm:text-xs"
                    >
                      {isEn ? "Reviews" : "Ревюта"}
                    </a>
                  ) : <span />}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
