import { cache } from "react";
import { after } from "next/server";
import { GoogleGenAI } from "@google/genai";
import pg from "pg";
import { newYorkDate, themeForDate } from "@/lib/battle";
import { createClient } from "@/lib/supabase/server";

export type DailyTheme = {
  day: string;
  theme: string;
  idea: string | null;
  trend: string | null;
  source: "x" | "google-trends" | "fallback";
};

const USER_AGENT = "Mozilla/5.0 (compatible; PunchlineThemeBot/1.0; +https://hello-world-humor-project-seven.vercel.app)";
const THEME_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"];

// ---------------------------------------------------------------------------
// Trend sources

/**
 * X (Twitter) trends for New York over the last 24 hours, via trends24.in,
 * which republishes X's hourly trending lists. Topics are ranked by how long
 * and how high they trended across the day, so the list reflects the day's
 * conversation rather than one moment.
 */
export async function fetchXTrends(): Promise<string[]> {
  const res = await fetch("https://trends24.in/united-states/new-york/", {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`trends24 responded ${res.status}`);
  const html = await res.text();

  const scores = new Map<string, number>();
  for (const hour of html.split("<div class=list-container>").slice(1)) {
    const names = [...hour.matchAll(/class=trend-link>([^<]+)<\/a>/g)].map((m) => decodeEntities(m[1].trim()));
    names.slice(0, 30).forEach((name, rank) => scores.set(name, (scores.get(name) ?? 0) + (30 - rank)));
  }
  return [...scores].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([name]) => name);
}

/** Backup source: Google's official daily trending-searches RSS feed for the US. */
export async function fetchGoogleTrends(): Promise<string[]> {
  const res = await fetch("https://trends.google.com/trending/rss?geo=US", {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`google trends responded ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<item>\s*<title>([^<]+)<\/title>/g)].map((m) => decodeEntities(m[1].trim())).slice(0, 40);
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// ---------------------------------------------------------------------------
// Turning trends into a theme

const THEME_PROMPT = `You pick the daily theme for Caption Battle, a game where Columbia University students in New York post a funny photo and AI writes captions for it.

You'll get today's trending topics, most-discussed first. Choose ONE topic that can be turned into a light, fun photo theme that a college student in New York could actually go photograph today (on campus, in the dorms, on the subway, around the city, or of their food, stuff, or friends).

Never choose: deaths, tragedies, disasters, storms, war, violence, crime, terrorism, politics or elections, religion, health scares, lawsuits, or anything about a specific private person. A sports team, a show, a holiday, a meme, a day of the week, or a celebrity's harmless moment is fine, but turn it into something photographable rather than just naming the person.

Return:
- theme: 2 to 5 words, title-style, playful (for example "Hump Day Survival Mode" or "Dance Like It's DWTS")
- trend: the exact trending topic you based it on
- idea: one short sentence telling students what to photograph (under 110 characters)
- usable: false only if nothing on the list can be made safe and fun`;

const THEME_SCHEMA = {
  type: "object",
  properties: {
    usable: { type: "boolean" },
    theme: { type: "string" },
    trend: { type: "string" },
    idea: { type: "string" },
  },
  required: ["usable", "theme", "trend", "idea"],
};

async function chooseTheme(trends: string[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });
  const list = trends.map((t, i) => `${i + 1}. ${t}`).join("\n");
  let lastError: unknown;

  for (const model of THEME_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: `Today's trending topics:\n${list}` }] }],
        config: { systemInstruction: THEME_PROMPT, responseMimeType: "application/json", responseJsonSchema: THEME_SCHEMA },
      });
      const out = JSON.parse(res.text ?? "{}") as { usable?: boolean; theme?: string; trend?: string; idea?: string };
      if (!out.usable || !out.theme?.trim()) return null;
      return {
        theme: out.theme.trim().slice(0, 60),
        trend: out.trend?.trim().slice(0, 80) || null,
        idea: out.idea?.trim().slice(0, 160) || null,
        model,
        prompt: `[system]\n${THEME_PROMPT}\n\n[user]\nToday's trending topics:\n${list}`,
      };
    } catch (error) {
      console.warn(`[daily-theme] ${model} failed, trying the next model`, error);
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Builds today's theme from live trends and saves it. Falls back to Google
 * Trends if X trends can't be fetched, and to the built-in rotation if no
 * trend is safe to use, so there is always exactly one theme per day.
 */
export async function generateDailyTheme(day = newYorkDate(), { replace = false } = {}) {
  const url = process.env.THEME_WRITER_DB_URL;
  if (!url) throw new Error("THEME_WRITER_DB_URL is not set");

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (!replace) {
      const existing = await client.query(
        "select day::text, theme, idea, trend, source from public.daily_themes where day = $1",
        [day],
      );
      if (existing.rows[0]) return existing.rows[0] as DailyTheme;
    }
    return await buildAndSaveTheme(client, day, replace);
  } finally {
    await client.end();
  }
}

async function buildAndSaveTheme(client: pg.Client, day: string, replace: boolean): Promise<DailyTheme | null> {
  let source: DailyTheme["source"] = "x";
  let trends: string[] = [];
  try {
    trends = await fetchXTrends();
  } catch (error) {
    console.error("[daily-theme] X trends unavailable, trying Google Trends", error);
  }
  if (trends.length === 0) {
    source = "google-trends";
    trends = await fetchGoogleTrends().catch(() => []);
  }

  const picked = trends.length > 0 ? await chooseTheme(trends).catch(() => null) : null;
  const row = picked
    ? { day, theme: picked.theme, idea: picked.idea, trend: picked.trend, source, trends, prompt: picked.prompt, model: picked.model }
    : { day, theme: themeForDate(day), idea: null, trend: null, source: "fallback" as const, trends, prompt: null, model: null };

  const { rows } = await client.query(
    `insert into public.daily_themes (day, theme, idea, trend, source, trends, prompt, model)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (day) do ${replace ? "update set theme = excluded.theme, idea = excluded.idea, trend = excluded.trend, source = excluded.source, trends = excluded.trends, prompt = excluded.prompt, model = excluded.model, created_at = now()" : "nothing"}
     returning day::text, theme, idea, trend, source`,
    [row.day, row.theme, row.idea, row.trend, row.source, JSON.stringify(row.trends), row.prompt, row.model],
  );
  if (rows[0]) return rows[0] as DailyTheme;
  // Another request saved today's theme first; return that one.
  const existing = await client.query(
    "select day::text, theme, idea, trend, source from public.daily_themes where day = $1",
    [row.day],
  );
  return (existing.rows[0] as DailyTheme | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Reading today's theme

let pending: Promise<unknown> | null = null;

/**
 * Today's theme, read once per request. If the daily job hasn't run yet,
 * visitors see the built-in theme for today and the trend-based one is
 * generated in the background right after the response.
 */
export const getDailyTheme = cache(async (): Promise<DailyTheme> => {
  const day = newYorkDate();
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_themes")
    .select("day, theme, idea, trend, source")
    .eq("day", day)
    .maybeSingle<DailyTheme>();
  if (data) return data;

  if (process.env.THEME_WRITER_DB_URL && !pending) {
    after(async () => {
      pending ??= generateDailyTheme(day).catch((error) => console.error("[daily-theme] generation failed", error));
      await pending;
      pending = null;
    });
  }
  return { day, theme: themeForDate(day), idea: null, trend: null, source: "fallback" };
});
