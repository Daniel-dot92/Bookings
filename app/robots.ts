import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/app/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/book", "/en/book"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}

