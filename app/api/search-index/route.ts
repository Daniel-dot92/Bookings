import { NextResponse } from "next/server";

const SEARCH_INDEX_URL = "https://www.dmphysi0.com/search-index.json";

export const revalidate = 3600;

export async function GET() {
  try {
    const response = await fetch(SEARCH_INDEX_URL, {
      next: { revalidate },
    });
    if (!response.ok) {
      return NextResponse.json(
        { pages: [], error: "Search index is unavailable." },
        { status: 502 }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { pages: [], error: "Search index is unavailable." },
      { status: 502 }
    );
  }
}
