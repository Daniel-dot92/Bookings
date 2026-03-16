import type { Metadata } from "next";
import BookingApp from "./BookingApp";
import { getBookingUrl } from "@/app/lib/site";

export const metadata: Metadata = {
  title: "Запази час | DM PHYSIO",
  description: "Онлайн записване на час в DM PHYSIO.",
  alternates: {
    canonical: getBookingUrl(),
  },
};

export default function Page() {
  return <BookingApp />;
}
