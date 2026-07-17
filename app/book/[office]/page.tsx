import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BookingApp from "@/app/book/BookingApp";
import {
  type OfficeKey,
  getOfficeDefinition,
} from "@/app/lib/booking-config";
import {
  BOOKING_SOCIAL_IMAGE,
  BOOKING_SOCIAL_IMAGE_URL,
} from "@/app/lib/booking-social";
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

export function generateStaticParams() {
  return Object.keys(OFFICE_SLUGS).map((office) => ({ office }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { office } = await params;
  const officeKey = getOfficeKey(office);

  if (!officeKey) {
    return {
      title: "Запази час | DM PHYSIO",
      alternates: { canonical: getBookingUrl() },
    };
  }

  const definition = getOfficeDefinition(officeKey);
  const officeCopy = definition.copy.bg;
  const canonical = `${getBookingUrl()}/${office}`;
  const title = `Запази час - ${officeCopy.district} | DM PHYSIO`;
  const description = `Запазване на час в DM PHYSIO, ${officeCopy.address}. Изберете терапевт, дата и свободен час за избрания обект.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "DM PHYSIO",
      locale: "bg_BG",
      type: "website",
      images: [BOOKING_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [BOOKING_SOCIAL_IMAGE_URL],
    },
    alternates: {
      canonical,
      languages: {
        "bg-BG": canonical,
        en: `${getBookingUrl().replace("/book", "/en/book")}/${office}`,
      },
    },
  };
}

export default async function OfficeBookingPage({ params }: PageProps) {
  const { office } = await params;
  const officeKey = getOfficeKey(office);

  if (!officeKey) redirect("/book");

  return <BookingApp initialOfficeKey={officeKey} lockedOffice />;
}
