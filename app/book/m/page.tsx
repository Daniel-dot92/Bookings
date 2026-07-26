import type { Metadata } from "next";
import ReviewLanding from "@/app/book/ReviewLanding";

export const metadata: Metadata = {
  title: "Оставете ревю - Младост 1А | DM PHYSIO",
  description: "Споделете своя опит с DM PHYSIO в Младост 1А.",
  robots: { index: false, follow: true },
};

export default function MladostReviewPage() {
  return <ReviewLanding officeKey="mladost-1a" />;
}
