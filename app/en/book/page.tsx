import type { Metadata } from "next";
import BookingAppEn from "@/app/book/BookingAppEn";
import { getSiteUrl } from "@/app/lib/site";

const enBookingUrl = `${getSiteUrl()}/en/book`;

export const metadata: Metadata = {
  title: "Book an appointment | DM PHYSIO",
  description: "Online appointment booking for physiotherapy and massage at DM PHYSIO in Sofia.",
  alternates: {
    canonical: enBookingUrl,
    languages: {
      "bg-BG": `${getSiteUrl()}/book`,
      en: enBookingUrl,
    },
  },
};

export default function Page() {
  return <BookingAppEn />;
}
