import { createClient } from "@/lib/supabase/server";

/**
 * Caption styles members can pick. `blurb` and `example` are shown in the
 * picker so it's obvious what each one sounds like; `prompt` goes to the model.
 */
export const VOICES = {
  groupchat: {
    label: "Group chat",
    blurb: "Casual and lowercase, like texting your friends.",
    example: "not the pigeon commuting better than me",
    prompt:
      "Casual Gen Z group-chat energy. Mostly lowercase, internet slang used naturally (not in every line), reads like a viral post caption. At most one emoji across all four captions.",
  },
  sarcastic: {
    label: "Sarcastic",
    blurb: "Dry and unimpressed, like a tired New Yorker.",
    example: "Ah yes, another “quick” ride on the 1 train.",
    prompt:
      "Dry, sarcastic, and unimpressed, like a lifelong New Yorker who has seen it all. Understated, a little put-upon; rent, the MTA, tourists, and slow walkers are fair game.",
  },
  wholesome: {
    label: "Wholesome",
    blurb: "Sweet, upbeat, and a little goofy.",
    example: "This little guy is doing his best, and honestly, so am I.",
    prompt:
      "Warm, wholesome, and a little goofy. Earnest and kind, like a friendly kid from the Midwest who's delighted by everything in the big city. No sarcasm.",
  },
  dramatic: {
    label: "Dramatic",
    blurb: "Over the top. Everything is a huge deal.",
    example: "I have never been more betrayed than by this dining hall pizza.",
    prompt:
      "Wildly over the top and theatrical. Treat small, everyday things like epic tragedies or historic triumphs. Big words, bigger feelings.",
  },
} as const;

export type VoiceId = keyof typeof VOICES;

export function isVoice(value: unknown): value is VoiceId {
  return typeof value === "string" && value in VOICES;
}

/** One theme per day, aimed at Columbia students who are new to New York. */
const THEMES = [
  "Subway sightings",
  "Dining hall crimes",
  "Dorm room reality",
  "Bodega cat energy",
  "Weekend in the city",
  "Butler Library at 2 a.m.",
  "Midwest vs. New York",
  "Rats of New York",
  "The $9 latte",
  "Central Park main character",
  "Laundry room horror",
  "Signs you're new here",
  "Campus squirrels",
  "NYC weather is lying",
  "Group project chaos",
  "Pigeon politics",
  "Late-night food run",
  "Your desk right now",
  "Lines you waited in",
  "Tiny apartment, big dreams",
];

const NY_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in New York as YYYY-MM-DD; days roll over at midnight Eastern. */
export function newYorkDate(at = new Date()) {
  return NY_DAY.format(at);
}

/** Start of today in New York, as an ISO timestamp for database filters. */
export function startOfNewYorkDay(at = new Date()) {
  const [y, m, d] = newYorkDate(at).split("-").map(Number);
  // Try both possible Eastern offsets and keep the one that lands on local midnight.
  for (const offset of [4, 5]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, offset));
    if (newYorkDate(candidate) === newYorkDate(at) && newYorkDate(new Date(candidate.getTime() - 1)) !== newYorkDate(at)) {
      return candidate.toISOString();
    }
  }
  return new Date(Date.UTC(y, m - 1, d, 5)).toISOString();
}

export function themeForDate(date = newYorkDate()) {
  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return THEMES[days % THEMES.length];
}

export const DAILY_POST_LIMIT = 10;

export type Caption = {
  id: string;
  generation_id: string;
  position: number;
  text: string;
  upvotes: number;
  downvotes: number;
  score: number;
};

export type Post = {
  id: string;
  user_id: string;
  author_name: string | null;
  image_url: string;
  image_path: string;
  theme: string | null;
  voice: VoiceId;
  top_score: number;
  created_at: string;
  captions: Caption[];
};

const POST_COLUMNS =
  "id, user_id, author_name, image_url, image_path, theme, voice, top_score, created_at, captions(id, generation_id, position, text, upvotes, downvotes, score)";

export type FeedSort = "today" | "new" | "top";

export const FEED_PAGE_SIZE = 12;

export async function getFeed(sort: FeedSort, page: number) {
  const supabase = await createClient();
  const from = (page - 1) * FEED_PAGE_SIZE;

  let query = supabase.from("generations").select(POST_COLUMNS, { count: "exact" });
  if (sort === "today") query = query.gte("created_at", startOfNewYorkDay());
  query =
    sort === "new"
      ? query.order("created_at", { ascending: false })
      : query.order("top_score", { ascending: false }).order("created_at", { ascending: false });

  const { data, count, error } = await query
    .order("position", { referencedTable: "captions" })
    .range(from, from + FEED_PAGE_SIZE - 1)
    .returns<Post[]>();

  return { posts: data ?? [], total: count ?? 0, error };
}

export async function getPost(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("generations")
    .select(POST_COLUMNS)
    .eq("id", id)
    .order("position", { referencedTable: "captions" })
    .maybeSingle<Post>();
  return data;
}

/** The signed-in member's votes on the given captions, as captionId → +1 / -1. */
export async function getMyVotes(captionIds: string[]) {
  const votes = new Map<string, 1 | -1>();
  if (captionIds.length === 0) return votes;
  const supabase = await createClient();
  const { data } = await supabase
    .from("caption_votes")
    .select("caption_id, value")
    .in("caption_id", captionIds);
  for (const row of data ?? []) votes.set(row.caption_id, row.value as 1 | -1);
  return votes;
}

/** What signed-out visitors (and link previews) get: a post's photo and winning caption only. */
export type PostPreview = {
  id: string;
  image_url: string;
  theme: string | null;
  voice: VoiceId;
  author_name: string | null;
  created_at: string;
  top_caption: string | null;
  top_score: number;
  caption_count: number;
};

/**
 * Reads through the battle_preview database function, the only way
 * signed-out visitors can see posts. It returns at most 3, ranked by score.
 */
export async function getPreview({ post, since, limit = 3 }: { post?: string; since?: string; limit?: number } = {}) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("battle_preview", {
    p_post: post ?? null,
    p_since: since ?? null,
    p_limit: limit,
  });
  return (data ?? []) as PostPreview[];
}

/** Today's best caption across every post, for the home page. */
export async function getTopCaptionToday() {
  const [leader] = await getPreview({ since: startOfNewYorkDay(), limit: 1 });
  return leader && leader.top_score > 0 && leader.top_caption ? leader : null;
}
