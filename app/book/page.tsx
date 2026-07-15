import type { Metadata } from "next";
import BookingLocationPicker from "./BookingLocationPicker";
import { getBookingUrl } from "@/app/lib/site";

export const metadata: Metadata = {
  title: "\u0417\u0430\u043f\u0430\u0437\u0438 \u0447\u0430\u0441 | DM PHYSIO",
  description:
    "\u041e\u043d\u043b\u0430\u0439\u043d \u0437\u0430\u043f\u0438\u0441\u0432\u0430\u043d\u0435 \u0437\u0430 \u0447\u0430\u0441 \u0432 DM PHYSIO. \u0418\u0437\u0431\u0435\u0440\u0438 \u043c\u0435\u0436\u0434\u0443 \u043e\u0431\u0435\u043a\u0442 \u0432 \u0421\u0442\u0443\u0434\u0435\u043d\u0442\u0441\u043a\u0438 \u0433\u0440\u0430\u0434 \u0438 \u041c\u043b\u0430\u0434\u043e\u0441\u0442 1\u0410.",
  alternates: {
    canonical: getBookingUrl(),
  },
};

export default function Page() {
  return <BookingLocationPicker locale="bg" />;
}
