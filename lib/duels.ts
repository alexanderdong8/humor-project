import { newYorkDate, startOfNewYorkDay, type MoodId, type Post } from "@/lib/battle";
import { createClient } from "@/lib/supabase/server";

export type DuelSide = { id: string; text: string; mood: MoodId | null };

export type Duel = {
  post: Pick<Post, "id" | "image_url" | "theme" | "author_name" | "kind" | "photo_credit" | "photo_source_url">;
  left: DuelSide;
  right: DuelSide;
  /** Matchups still waiting for this member, including this one. */
  remaining: number;
};

/** A pair of captions as stored: ordered ids joined by a colon. */
export function pairKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

type CandidateCaption = {
  id: string;
  text: string;
  duel_wins: number;
  duel_losses: number;
  remix: { mood: MoodId } | null;
};

type CandidatePost = Duel["post"] & {
  created_at: string;
  daily_for: string | null;
  captions: CandidateCaption[];
};

/**
 * Picks the next head-to-head matchup for a member: two captions from the
 * same post they haven't judged yet (and didn't skip), never on their own
 * post. Today's AI photo comes first, then today's posts, then older ones,
 * and within that, captions with the fewest matchups so far.
 */
export async function getNextDuel(userId: string, skip: string[] = []): Promise<Duel | null> {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("generations")
    .select(
      "id, image_url, theme, author_name, kind, photo_credit, photo_source_url, created_at, daily_for, captions(id, text, duel_wins, duel_losses, remix:caption_remixes(mood))",
    )
    .or(`user_id.is.null,user_id.neq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(60)
    .returns<CandidatePost[]>();
  if (!posts?.length) return null;

  const { data: judged } = await supabase
    .from("caption_duels")
    .select("caption_a, caption_b")
    .in(
      "generation_id",
      posts.map((p) => p.id),
    );
  const seen = new Set([...(judged ?? []).map((d) => pairKey(d.caption_a, d.caption_b)), ...skip]);

  const today = newYorkDate();
  const todayStart = Date.parse(startOfNewYorkDay());
  const candidates: { post: CandidatePost; a: CandidateCaption; b: CandidateCaption; tier: number; exposure: number }[] =
    [];

  for (const post of posts) {
    const tier = post.daily_for === today ? 0 : Date.parse(post.created_at) >= todayStart ? 1 : 2;
    const caps = post.captions ?? [];
    for (let i = 0; i < caps.length; i++) {
      for (let j = i + 1; j < caps.length; j++) {
        if (seen.has(pairKey(caps[i].id, caps[j].id))) continue;
        const exposure = caps[i].duel_wins + caps[i].duel_losses + caps[j].duel_wins + caps[j].duel_losses;
        candidates.push({ post, a: caps[i], b: caps[j], tier, exposure });
      }
    }
  }
  if (candidates.length === 0) return null;

  // Stay in the best tier, favor fresh captions, and shuffle a little so it doesn't feel scripted.
  candidates.sort((x, y) => x.tier - y.tier || x.exposure - y.exposure);
  const shortlist = candidates.filter((c) => c.tier === candidates[0].tier).slice(0, 6);
  const pick = shortlist[Math.floor(Math.random() * shortlist.length)];
  const side = (c: CandidateCaption): DuelSide => ({ id: c.id, text: c.text, mood: c.remix?.mood ?? null });
  const [left, right] = Math.random() < 0.5 ? [side(pick.a), side(pick.b)] : [side(pick.b), side(pick.a)];

  const { id, image_url, theme, author_name, kind, photo_credit, photo_source_url } = pick.post;
  return {
    post: { id, image_url, theme, author_name, kind, photo_credit, photo_source_url },
    left,
    right,
    remaining: candidates.length,
  };
}

/** How many matchups the member has judged today (New York time). */
export async function getJudgedToday(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("caption_duels")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfNewYorkDay());
  return count ?? 0;
}
