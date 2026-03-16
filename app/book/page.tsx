import type { Metadata } from "next";
import BookingApp from "./BookingApp";
import { getBookingUrl } from "@/app/lib/site";

export const metadata: Metadata = {
  title: "\u0417\u0430\u043f\u0430\u0437\u0438 \u0447\u0430\u0441 | DM PHYSIO",
  description: "\u041e\u043d\u043b\u0430\u0439\u043d \u0437\u0430\u043f\u0438\u0441\u0432\u0430\u043d\u0435 \u043d\u0430 \u0447\u0430\u0441 \u0432 DM PHYSIO.",
  alternates: {
    canonical: getBookingUrl(),
  },
};

export default function Page() {
  return <BookingApp />;
}
