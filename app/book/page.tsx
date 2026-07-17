import type { Metadata } from "next";
import BookingLocationPicker from "./BookingLocationPicker";
import {
  BOOKING_SOCIAL_IMAGE,
  BOOKING_SOCIAL_IMAGE_URL,
} from "@/app/lib/booking-social";
import { getBookingUrl } from "@/app/lib/site";

const bookingUrl = getBookingUrl();
const bookingTitle = "\u0417\u0430\u043f\u0430\u0437\u0438 \u0447\u0430\u0441 | DM PHYSIO";
const bookingDescription =
  "\u041e\u043d\u043b\u0430\u0439\u043d \u0437\u0430\u043f\u0438\u0441\u0432\u0430\u043d\u0435 \u0437\u0430 \u0447\u0430\u0441 \u0432 DM PHYSIO. \u0418\u0437\u0431\u0435\u0440\u0438 \u043c\u0435\u0436\u0434\u0443 \u043e\u0431\u0435\u043a\u0442 \u0432 \u0421\u0442\u0443\u0434\u0435\u043d\u0442\u0441\u043a\u0438 \u0433\u0440\u0430\u0434 \u0438 \u041c\u043b\u0430\u0434\u043e\u0441\u0442 1\u0410.";

export const metadata: Metadata = {
  title: bookingTitle,
  description: bookingDescription,
  openGraph: {
    title: bookingTitle,
    description: bookingDescription,
    url: bookingUrl,
    siteName: "DM PHYSIO",
    locale: "bg_BG",
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
    canonical: bookingUrl,
  },
};

export default function Page() {
  return <BookingLocationPicker locale="bg" />;
}
