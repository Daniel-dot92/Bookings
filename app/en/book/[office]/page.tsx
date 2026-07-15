import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BookingAppEn from "@/app/book/BookingAppEn";
import {
  type OfficeKey,
  getOfficeDefinition,
} from "@/app/lib/booking-config";
import { getBookingUrl } from "@/app/lib/site";

const OFFICE_SLUGS: Record<string, OfficeKey> = {
  "hristo-danov": "studentski-grad",
  mladost: "mladost-1a",
};

type PageProps = {
  params: Promise<{ office: string }>;
};

function getOfficeKey(slug: string): OfficeKey | null {
  return OFFICE_SLUGS[slug] || null;
}

function getEnBookingUrl() {
  return getBookingUrl().replace("/book", "/en/book");
}

export function generateStaticParams() {
  return Object.keys(OFFICE_SLUGS).map((office) => ({ office }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { office } = await params;
  const officeKey = getOfficeKey(office);

  if (!officeKey) {
    return {
      title: "Book an appointment | DM PHYSIO",
      alternates: { canonical: getEnBookingUrl() },
    };
  }

  const definition = getOfficeDefinition(officeKey);
  const officeCopy = definition.copy.en;
  const canonical = `${getEnBookingUrl()}/${office}`;

  return {
    title: `Book an appointment - ${officeCopy.district} | DM PHYSIO`,
    description: `Book an appointment at DM PHYSIO, ${officeCopy.address}. Choose a therapist, date and available time for this studio.`,
    alternates: {
      canonical,
      languages: {
        "bg-BG": `${getBookingUrl()}/${office}`,
        en: canonical,
      },
    },
  };
}

export default async function EnglishOfficeBookingPage({ params }: PageProps) {
  const { office } = await params;
  const officeKey = getOfficeKey(office);

  if (!officeKey) redirect("/en/book");

  return <BookingAppEn initialOfficeKey={officeKey} lockedOffice />;
}
