import { NextResponse, type NextRequest } from "next/server";
import { generateDailyTheme } from "@/lib/daily-theme";

// Scraping trends plus one model call can take a little while.
export const maxDuration = 60;

/**
 * Called by Vercel Cron just after midnight Eastern (see vercel.json) to
 * build the day's Caption Battle theme from X trends. Vercel signs the
 * request with CRON_SECRET; anything else is rejected.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const replace = request.nextUrl.searchParams.get("replace") === "1";
  try {
    const theme = await generateDailyTheme(undefined, { replace });
    return NextResponse.json({ ok: true, theme });
  } catch (error) {
    console.error("[cron/daily-theme] failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
