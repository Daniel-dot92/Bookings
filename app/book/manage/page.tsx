import Link from "next/link";
import {
  type OfficeKey,
  getOfficeDefinition,
  isOfficeKey,
} from "@/app/lib/booking-config";

type ManagePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readOfficeKey(value: string | string[] | undefined): OfficeKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isOfficeKey(candidate) ? candidate : "studentski-grad";
}

export default async function ManageBookingPage(props: ManagePageProps) {
  const resolvedSearchParams = (await props.searchParams) || {};
  const officeKey = readOfficeKey(resolvedSearchParams.office);
  const office = getOfficeDefinition(officeKey);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_45%,#ecfeff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 px-6 py-6">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
            DM Physio
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Промяна или отказ на час
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Ако искате да промените или отмените часа си, свържете се с нас на посочения
            телефон за избрания обект.
          </p>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-lg font-semibold text-slate-950">
              {office.copy.bg.name}
            </div>
            <div className="mt-2 text-sm text-slate-600">{office.copy.bg.address}</div>
            <a
              href={`tel:${office.contactPhone}`}
              className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Обадете се: {office.contactPhone}
            </a>
          </div>

          <div className="rounded-[24px] border border-cyan-100 bg-cyan-50 p-5 text-sm leading-6 text-slate-700">
            При обаждането кажете името си и приблизителния час на запазения преглед, за да
            ви открием по-бързо.
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/book"
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Назад към свободните часове
            </Link>
            <a
              href={office.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-5 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-100"
            >
              Виж в Google Maps
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
