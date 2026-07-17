import type { Metadata } from "next";
import BookingLocationPicker from "@/app/book/BookingLocationPicker";
import {
  BOOKING_SOCIAL_IMAGE,
  BOOKING_SOCIAL_IMAGE_URL,
} from "@/app/lib/booking-social";
import { getSiteUrl } from "@/app/lib/site";

const enBookingUrl = `${getSiteUrl()}/en/book`;
const bookingTitle = "Book an appointment | DM PHYSIO";
const bookingDescription =
  "Online appointment booking for physiotherapy and massage at DM PHYSIO in Sofia. Choose between the Studentski Grad and Mladost 1A studios.";

export const metadata: Metadata = {
  title: bookingTitle,
  description: bookingDescription,
  openGraph: {
    title: bookingTitle,
    description: bookingDescription,
    url: enBookingUrl,
    siteName: "DM PHYSIO",
    locale: "en_GB",
    type: "website",
    images: [BOOKING_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: bookingTitle,
    description: bookingDescription,
    images: [BOOKING_SOCIAL_IMAGE_URL],
  },
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
