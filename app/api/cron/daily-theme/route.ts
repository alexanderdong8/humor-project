import { NextResponse, type NextRequest } from "next/server";
import { buildDailyPost, generateDailyPost } from "@/lib/daily-post";
import { generateDailyTheme } from "@/lib/daily-theme";

// Trends, a photo search, and several model calls (with fallbacks when Gemini is
// busy) can take over a minute; 300s is the Hobby plan maximum.
export const maxDuration = 300;

/**
 * Called by Vercel Cron just after midnight Eastern (see vercel.json) to set
 * up the day: the theme (from trends) and the daily AI meme.
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
    if (!theme) return NextResponse.json({ ok: false, theme });
    if (dryRun) {
      // Also pick and caption a meme, but save nothing.
      const post = await buildDailyPost(theme.day, theme).catch((error) => ({ error: String(error) }));
      const summary =
        "template" in post
          ? { meme: post.template.name, image: post.template.url, captions: post.captions, model: post.model }
          : post;
      return NextResponse.json({ ok: true, theme, dailyPost: summary });
    }

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
