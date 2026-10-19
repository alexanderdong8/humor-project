import { createClient } from "@/lib/supabase/server";

/**
 * Caption styles members can pick. `blurb` and `example` are shown in the
 * picker so it's obvious what each one sounds like; `prompt` goes to the model.
 */
export const VOICES = {
  groupchat: {
    emoji: "💬",
    label: "Group chat",
    blurb: "Casual and lowercase, like texting your friends.",
    example: "not the pigeon commuting better than me",
    prompt:
      "Casual Gen Z group-chat energy. Mostly lowercase, internet slang used naturally (not in every line), reads like a viral post caption. At most one emoji across all four captions.",
  },
  sarcastic: {
    emoji: "🙄",
    label: "Sarcastic",
    blurb: "Dry and unimpressed, like a tired New Yorker.",
    example: "Ah yes, another “quick” ride on the 1 train.",
    prompt:
      "Dry, sarcastic, and unimpressed, like a lifelong New Yorker who has seen it all. Understated, a little put-upon; rent, the MTA, tourists, and slow walkers are fair game.",
  },
  wholesome: {
    emoji: "🥹",
    label: "Wholesome",
    blurb: "Sweet, upbeat, and a little goofy.",
    example: "This little guy is doing his best, and honestly, so am I.",
    prompt:
      "Warm, wholesome, and a little goofy. Earnest and kind, like a friendly kid from the Midwest who's delighted by everything in the big city. No sarcasm.",
  },
  dramatic: {
    emoji: "🎭",
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

export { isMood, MOODS, type MoodId } from "@/lib/moods";
import type { MoodId } from "@/lib/moods";

/** New captions per remix; they battle the current caption in the owner's bracket. */
export const REMIX_CAPTIONS = 3;
/** Remixes aren't capped per photo, but each member gets 20 a day to keep AI costs sane. */
export const REMIXES_PER_DAY = 20;

export type Caption = {
  id: string;
  generation_id: string;
  position: number;
  text: string;
  duel_wins: number;
  duel_losses: number;
  remix: { mood: MoodId } | null;
};

export type Post = {
  id: string;
  user_id: string | null;
  kind: "member" | "daily";
  status: "draft" | "published";
  author_name: string | null;
  image_url: string;
  image_path: string;
  theme: string | null;
  voice: VoiceId;
  caption_id: string | null;
  battle_wins: number;
  battle_losses: number;
  photo_credit: string | null;
  photo_source_url: string | null;
  published_at: string | null;
  created_at: string;
  captions: Caption[];
};

/** A post as shown on boards and in battles: its one chosen caption, no candidates. */
export type BoardPost = Pick<
  Post,
  "id" | "kind" | "status" | "author_name" | "image_url" | "theme" | "voice" | "battle_wins" | "battle_losses" | "published_at" | "created_at"
> & { caption: { id: string; text: string; remix: { mood: MoodId } | null } | null };

const CAPTION_FIELDS = "id, generation_id, position, text, duel_wins, duel_losses, remix:caption_remixes(mood)";

// Posts and captions are linked two ways (a post's candidate captions, and the
// one it chose), so each embed names the foreign key it follows.
const POST_COLUMNS = `id, user_id, kind, status, author_name, image_url, image_path, theme, voice, caption_id, battle_wins, battle_losses, photo_credit, photo_source_url, published_at, created_at, captions:captions!captions_generation_id_fkey(${CAPTION_FIELDS})`;

export const BOARD_COLUMNS =
  "id, kind, status, author_name, image_url, theme, voice, battle_wins, battle_losses, published_at, created_at, caption:captions!generations_caption_id_fkey(id, text, remix:caption_remixes(mood))";

export function chosenCaption(post: Pick<Post, "caption_id" | "captions">) {
  return post.captions.find((c) => c.id === post.caption_id) ?? null;
}

/** Whole-number win percentage, or null before the first battle. */
export function winRate(wins: number, losses: number) {
  const total = wins + losses;
  return total === 0 ? null : Math.round((wins / total) * 100);
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

/** The daily AI meme for a New York day (today by default). */
export async function getDailyPost(day = newYorkDate()) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("generations")
    .select(POST_COLUMNS)
    .eq("daily_for", day)
    .order("position", { referencedTable: "captions" })
    .maybeSingle<Post>();
  return data;
}

export type BoardRange = "today" | "week" | "all";
export const BOARD_PAGE_SIZE = 20;

/** Published member posts ranked by battle record (smoothed win rate, then wins). */
export async function getLeaderboard(range: BoardRange, page: number) {
  const supabase = await createClient();
  const from = (page - 1) * BOARD_PAGE_SIZE;

  let query = supabase
    .from("generations")
    .select(BOARD_COLUMNS, { count: "exact" })
    .eq("kind", "member")
    .eq("status", "published")
    .not("caption_id", "is", null);
  if (range === "today") query = query.gte("published_at", startOfNewYorkDay());
  if (range === "week") query = query.gte("published_at", new Date(Date.now() - 7 * 86_400_000).toISOString());

  const { data, count, error } = await query
    .order("battle_rating", { ascending: false })
    .order("battle_wins", { ascending: false })
    .order("published_at", { ascending: false })
    .range(from, from + BOARD_PAGE_SIZE - 1)
    .returns<BoardPost[]>();
  return { posts: data ?? [], total: count ?? 0, error };
}

/** The member's own posts, newest first, including drafts still waiting for a caption. */
export async function getMyPosts(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("generations")
    .select(BOARD_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(24)
    .returns<BoardPost[]>();
  return data ?? [];
}

/** What signed-out visitors (and link previews) get: a published post and its caption. */
export type PostPreview = {
  id: string;
  kind: "member" | "daily";
  image_url: string;
  theme: string | null;
  voice: VoiceId;
  author_name: string | null;
  published_at: string;
  caption: string | null;
  caption_count: number;
  battle_wins: number;
  battle_losses: number;
  photo_credit: string | null;
  photo_source_url: string | null;
};

/**
 * Reads through the battle_preview database function, the only way signed-out
 * visitors can see posts. It returns at most 3, best battle record first.
 */
export async function getPreview({
  post,
  since,
  limit = 3,
  kind = "member",
}: { post?: string; since?: string; limit?: number; kind?: "member" | "daily" } = {}) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("battle_preview", {
    p_post: post ?? null,
    p_since: since ?? null,
    p_limit: limit,
    p_kind: kind,
  });
  return (data ?? []) as PostPreview[];
}

/** Today's best post by battle record, for the home page. */
export async function getTopPostToday() {
  const [leader] = await getPreview({ since: startOfNewYorkDay(), limit: 1 });
  return leader && leader.battle_wins > 0 ? leader : null;
}
