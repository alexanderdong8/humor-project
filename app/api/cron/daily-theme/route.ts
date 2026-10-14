import { NextResponse, type NextRequest } from "next/server";
import { generateDailyPost } from "@/lib/daily-post";
import { generateDailyTheme } from "@/lib/daily-theme";

// Trends, a photo search, and a few model calls can take a little while.
export const maxDuration = 60;

/**
 * Called by Vercel Cron just after midnight Eastern (see vercel.json) to set
 * up the day's Caption Battle: the theme (from trends) and the AI photo post.
 * Vercel signs the request with CRON_SECRET; anything else is rejected.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const replace = params.get("replace") === "1";
  // ?dry=1 fetches trends and picks a theme without saving anything, for checking the pipeline.
  const dryRun = params.get("dry") === "1";
  try {
    const theme = await generateDailyTheme(undefined, { replace, dryRun });
    if (dryRun || !theme) return NextResponse.json({ ok: Boolean(theme), theme });

    const postId = await generateDailyPost(theme.day, theme).catch((error) => {
      console.error("[cron/daily-theme] daily post failed", error);
      return null;
    });
    return NextResponse.json({ ok: true, theme, dailyPost: postId });
  } catch (error) {
    console.error("[cron/daily-theme] failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
