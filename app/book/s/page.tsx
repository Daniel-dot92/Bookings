import type { Metadata } from "next";
import ReviewLanding from "@/app/book/ReviewLanding";

export const metadata: Metadata = {
  title: "Оставете ревю - Студентски град | DM PHYSIO",
  description: "Споделете своя опит с DM PHYSIO в Студентски град.",
  robots: { index: false, follow: true },
};

export default function StudentskiReviewPage() {
  return <ReviewLanding officeKey="studentski-grad" />;
}
