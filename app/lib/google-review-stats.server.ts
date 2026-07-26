import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import type { OfficeKey } from "@/app/lib/booking-config";

export type GoogleReviewStats = {
  rating: number;
  reviewCount: number;
};

export const GOOGLE_REVIEW_STATS_CACHE_TAG = "google-review-stats";

const GOOGLE_PLACE_IDS: Record<OfficeKey, string> = {
  "studentski-grad": "ChIJfY2wm_mFqkARbaaPH-y17Zc",
  "mladost-1a": "ChIJeUA7SAWHqkARVGSX-lR8Rx4",
};

type PlaceDetailsResponse = {
  rating?: number;
  userRatingCount?: number;
  error?: {
    message?: string;
  };
};

async function requestGoogleReviewStats(
  officeKey: OfficeKey
): Promise<GoogleReviewStats | null> {
  const apiKey = (process.env.GOOGLE_PLACES_API_KEY || "").trim();
  if (!apiKey) return null;

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${GOOGLE_PLACE_IDS[officeKey]}?languageCode=bg`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount",
      },
      cache: "no-store",
    }
  );

  const data = (await response.json()) as PlaceDetailsResponse;

  if (!response.ok) {
    throw new Error(
      data.error?.message || `Google Places returned ${response.status}`
    );
  }

  if (
    typeof data.rating !== "number" ||
    typeof data.userRatingCount !== "number"
  ) {
    return null;
  }

  return {
    rating: data.rating,
    reviewCount: data.userRatingCount,
  };
}

const getCachedGoogleReviewStats = unstable_cache(
  requestGoogleReviewStats,
  ["dm-physio-google-review-stats-v1"],
  {
    revalidate: 60 * 60 * 24 * 31,
    tags: [GOOGLE_REVIEW_STATS_CACHE_TAG],
  }
);

export async function getGoogleReviewStats(officeKey: OfficeKey) {
  if (!(process.env.GOOGLE_PLACES_API_KEY || "").trim()) return null;

  try {
    return await getCachedGoogleReviewStats(officeKey);
  } catch (error) {
    console.error(`[GOOGLE_REVIEWS] ${officeKey} update failed:`, error);
    return null;
  }
}

export async function refreshGoogleReviewStats() {
  revalidateTag(GOOGLE_REVIEW_STATS_CACHE_TAG);

  const [studentski, mladost] = await Promise.all([
    getGoogleReviewStats("studentski-grad"),
    getGoogleReviewStats("mladost-1a"),
  ]);

  return {
    "studentski-grad": studentski,
    "mladost-1a": mladost,
  };
}
