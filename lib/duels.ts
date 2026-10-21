import type { MoodId } from "@/lib/battle";
import { createClient } from "@/lib/supabase/server";

export type DuelSide = { id: string; text: string; mood: MoodId | null };

export type Duel = { left: DuelSide; right: DuelSide; remaining: number };

/** A pair of captions as stored: ordered ids joined by a colon. */
export function pairKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

type CandidateCaption = DuelSide & { duel_wins: number; duel_losses: number };

/**
 * Picks the next caption-vs-caption matchup on the daily AI meme: two of its
 * captions the member hasn't judged together (or skipped), favoring captions
 * with the fewest matchups so far.
 */
export async function getNextDailyDuel(userId: string, postId: string, skip: string[] = []): Promise<Duel | null> {
  const supabase = await createClient();
  const [{ data: captions }, { data: judged }] = await Promise.all([
    supabase.from("captions").select("id, text, duel_wins, duel_losses").eq("generation_id", postId),
    // Filter by user explicitly: superadmins can read everyone's duels.
    supabase.from("caption_duels").select("caption_a, caption_b").eq("generation_id", postId).eq("user_id", userId),
  ]);
  const caps = (captions ?? []).map((c) => ({ ...c, mood: null })) as CandidateCaption[];
  const seen = new Set([...(judged ?? []).map((d) => pairKey(d.caption_a, d.caption_b)), ...skip]);

  const pairs: { a: CandidateCaption; b: CandidateCaption; exposure: number }[] = [];
  for (let i = 0; i < caps.length; i++) {
    for (let j = i + 1; j < caps.length; j++) {
      if (seen.has(pairKey(caps[i].id, caps[j].id))) continue;
      pairs.push({
        a: caps[i],
        b: caps[j],
        exposure: caps[i].duel_wins + caps[i].duel_losses + caps[j].duel_wins + caps[j].duel_losses,
      });
    }
  }
  if (pairs.length === 0) return null;

  pairs.sort((x, y) => x.exposure - y.exposure);
  const shortlist = pairs.slice(0, 3);
  const pick = shortlist[Math.floor(Math.random() * shortlist.length)];
  const side = ({ id, text, mood }: CandidateCaption): DuelSide => ({ id, text, mood });
  const [left, right] = Math.random() < 0.5 ? [side(pick.a), side(pick.b)] : [side(pick.b), side(pick.a)];
  return { left, right, remaining: pairs.length };
}
