"use server";

import { getNextDailyDuel, type Duel } from "@/lib/duels";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[0-9a-f-]{36}:[0-9a-f-]{36}$/i;

export type DuelResult =
  | { ok: true; stats: { [captionId: string]: { wins: number; losses: number } }; next: Duel | null }
  | { ok: false; error: "signin" | "failed" };

/**
 * Saves one pick between two of the daily meme's captions (a row in
 * caption_duels; RLS only allows it on daily posts), then returns both
 * captions' updated records and the next pair.
 */
export async function judgeDailyDuel(
  input: { postId: string; winner: string; loser: string },
  skip: string[] = [],
): Promise<DuelResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "signin" };
  if (![input.postId, input.winner, input.loser].every((id) => UUID.test(id)) || input.winner === input.loser) {
    return { ok: false, error: "failed" };
  }

  const [captionA, captionB] = [input.winner, input.loser].sort();
  const { error } = await supabase.from("caption_duels").insert({
    generation_id: input.postId,
    caption_a: captionA,
    caption_b: captionB,
    winner: input.winner,
  });
  if (error && error.code !== "23505") {
    console.error("[daily] duel failed", error);
    return { ok: false, error: "failed" };
  }

  const [{ data: rows }, next] = await Promise.all([
    supabase.from("captions").select("id, duel_wins, duel_losses").in("id", [captionA, captionB]),
    getNextDailyDuel(user.id, input.postId, skip.filter((k) => KEY.test(k))),
  ]);
  const stats = Object.fromEntries((rows ?? []).map((r) => [r.id, { wins: r.duel_wins, losses: r.duel_losses }]));
  return { ok: true, stats, next };
}

export async function skipDailyDuel(postId: string, skip: string[]): Promise<Duel | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !UUID.test(postId)) return null;
  return getNextDailyDuel(user.id, postId, skip.filter((k) => KEY.test(k)).slice(0, 50));
}
