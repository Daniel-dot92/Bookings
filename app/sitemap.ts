import type { MetadataRoute } from "next";
import { getBookingUrl } from "@/app/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: getBookingUrl(),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}

