"use server";

import { getNextMatchup, type Matchup } from "@/lib/arena";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[0-9a-f-]{36}:[0-9a-f-]{36}$/i;

export type BattleRecord = { wins: number; losses: number };

export type BattleResult =
  | { ok: true; records: { [postId: string]: BattleRecord }; next: Matchup | null }
  | { ok: false; error: "signin" | "failed" };

/**
 * Saves one vote as a row in post_battles (RLS checks both uploads are
 * published and neither is the voter's), then returns both uploads' updated
 * records and the next matchup.
 */
export async function judgeMatchup(
  input: { winner: string; loser: string },
  skip: string[] = [],
): Promise<BattleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "signin" };
  if (!UUID.test(input.winner) || !UUID.test(input.loser) || input.winner === input.loser) {
    return { ok: false, error: "failed" };
  }

  const [postA, postB] = [input.winner, input.loser].sort();
  const { error } = await supabase.from("post_battles").insert({ post_a: postA, post_b: postB, winner: input.winner });
  // 23505: already judged this matchup (e.g. a double tap); treat it as done.
  if (error && error.code !== "23505") {
    console.error("[vote] saving vote failed", error);
    return { ok: false, error: "failed" };
  }

  const [{ data: rows }, next] = await Promise.all([
    supabase.from("generations").select("id, battle_wins, battle_losses").in("id", [postA, postB]),
    getNextMatchup(user.id, skip.filter((k) => KEY.test(k))),
  ]);
  const records = Object.fromEntries((rows ?? []).map((r) => [r.id, { wins: r.battle_wins, losses: r.battle_losses }]));
  return { ok: true, records, next };
}

/** Skips the current matchup (the client passes every matchup it has skipped). */
export async function skipMatchup(skip: string[]): Promise<Matchup | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getNextMatchup(user.id, skip.filter((k) => KEY.test(k)).slice(0, 200));
}

