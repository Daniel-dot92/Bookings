import BookingAppClient from "@/app/book/BookingAppClient";
import type { OfficeKey } from "@/app/lib/booking-config";

type Props = {
  initialOfficeKey?: OfficeKey | null;
  lockedOffice?: boolean;
};

export default function BookingApp(props: Props) {
  return <BookingAppClient locale="bg" {...props} />;
}
