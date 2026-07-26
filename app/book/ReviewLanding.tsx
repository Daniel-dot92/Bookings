import Image from "next/image";
import {
  type OfficeKey,
  getOfficeDefinition,
} from "@/app/lib/booking-config";
import { getReviewLinkForOffice } from "@/app/lib/appointment-communications";
import { getGoogleReviewStats } from "@/app/lib/google-review-stats.server";

type ReviewLandingProps = {
  officeKey: OfficeKey;
};

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-5 w-5"
    >
      <path
        d="M7 4h9v9M15.5 4.5 7 13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 10.5V16H4V7h5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function ReviewLanding({
  officeKey,
}: ReviewLandingProps) {
  const office = getOfficeDefinition(officeKey);
  const copy = office.copy.bg;
  const reviewLink = getReviewLinkForOffice(officeKey) || office.mapsUrl;
  const liveStats = await getGoogleReviewStats(officeKey);
  const googleRating = liveStats?.rating ?? office.googleRating;
  const googleReviewCount =
    liveStats?.reviewCount ?? office.googleReviewCount;
  const hasReviewCount = Boolean(googleReviewCount);
  const hasRating = Boolean(googleRating);

  return (
    <main className="relative min-h-[calc(100svh-var(--tb-h,64px))] overflow-hidden bg-[#f4f2eb] px-4 py-8 text-[#10231d] sm:px-6 sm:py-12">
      <div
        aria-hidden="true"
        className="absolute -left-28 top-20 h-80 w-80 rounded-full bg-[#cde8d8]/65 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-28 bottom-0 h-96 w-96 rounded-full bg-[#f2cfa8]/55 blur-3xl"
      />

      <section className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-[30px] border border-black/8 bg-[#fffdf8] shadow-[0_28px_80px_rgba(31,54,45,0.14)] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative min-h-[300px] bg-[#e8ece8] sm:min-h-[430px] lg:min-h-[590px]">
          <Image
            src={office.photo || "/logo.webp"}
            alt={`DM Physio ${copy.district} - ${copy.address}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 54vw"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent px-6 pb-6 pt-24 text-white sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/75">
              DM Physio
            </p>
            <p className="mt-2 text-xl font-semibold sm:text-2xl">
              {copy.district}
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
          <p
            className="text-lg font-semibold leading-tight tracking-[-0.02em] text-[#08785f] sm:text-xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Благодарим Ви за доверието
          </p>
          <h1
            className="mt-3 text-[2.05rem] font-semibold leading-[1.08] tracking-[-0.035em] text-[#10231d] sm:text-[2.7rem]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Доволни ли сте от посещението си?
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-[#52615c]">
            Вашият отзив ни помага да ставаме по-добри и улеснява други хора
            при избора им.
          </p>

          {hasReviewCount ? (
            <div className="mt-7 flex items-center gap-4 rounded-2xl border border-[#dce8e3] bg-white px-5 py-4">
              <span className="text-3xl font-semibold text-[#10231d]">
                {hasRating
                  ? googleRating?.toFixed(1)
                  : googleReviewCount}
              </span>
              <div>
                {hasRating ? (
                  <div
                    className="text-lg tracking-[0.08em] text-[#e9a326]"
                    aria-label={`${googleRating} от 5 звезди`}
                  >
                    ★★★★★
                  </div>
                ) : null}
                <p className="mt-0.5 text-sm text-[#64736d]">
                  {googleReviewCount}{" "}
                  {googleReviewCount === 1
                    ? "Google отзив"
                    : "Google отзива"}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-[#dce8e3] bg-white px-5 py-4">
              <p className="text-sm font-semibold text-[#10231d]">
                {copy.district}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#64736d]">
                Вашето мнение ще бъде сред първите отзиви за новия ни обект.
              </p>
            </div>
          )}

          <div className="mt-7 grid gap-3">
            <a
              href={reviewLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#08785f] px-5 py-3.5 text-center text-base font-bold text-white shadow-[0_10px_24px_rgba(8,120,95,0.22)] transition hover:bg-[#06664f]"
            >
              Оставете отзив в Google
              <ArrowIcon />
            </a>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-[#718079]">
            Отнема по-малко от минута.
          </p>
        </div>
      </section>
    </main>
  );
}
