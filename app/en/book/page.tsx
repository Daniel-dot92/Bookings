import type { Metadata } from "next";
import BookingLocationPicker from "@/app/book/BookingLocationPicker";
import { getSiteUrl } from "@/app/lib/site";

const enBookingUrl = `${getSiteUrl()}/en/book`;

export const metadata: Metadata = {
  title: "Book an appointment | DM PHYSIO",
  description:
    "Online appointment booking for physiotherapy and massage at DM PHYSIO in Sofia. Choose between the Studentski Grad and Mladost 1A studios.",
  alternates: {
    canonical: enBookingUrl,
    languages: {
      "bg-BG": `${getSiteUrl()}/book`,
      en: enBookingUrl,
    },
  },
};

export default function Page() {
  return <BookingLocationPicker locale="en" />;
}
