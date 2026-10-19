import { matchKey, type Contender, type Matchup } from "@/lib/arena-shared";
import { startOfNewYorkDay, type MoodId } from "@/lib/battle";
import { createClient } from "@/lib/supabase/server";

export { matchKey, type Contender, type Matchup };

type Candidate = Omit<Contender, "caption" | "mood"> & {
  published_at: string;
  caption: { text: string; remix: { mood: MoodId } | null } | null;
};

/**
 * Picks the next post-vs-post battle for a member: two published posts by
 * other people that they haven't judged together yet (or skipped). Today's
 * posts come first, then posts with the fewest battles, with a little shuffle.
 */
export async function getNextMatchup(userId: string, skip: string[] = []): Promise<Matchup | null> {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("generations")
    .select(
      "id, image_url, author_name, theme, battle_wins, battle_losses, published_at, caption:captions!generations_caption_id_fkey(text, remix:caption_remixes(mood))",
    )
    .eq("kind", "member")
    .eq("status", "published")
    .not("caption_id", "is", null)
    .neq("user_id", userId)
    .order("published_at", { ascending: false })
    .limit(60)
    .returns<Candidate[]>();
  const usable = (posts ?? []).filter((p) => p.caption);
  if (usable.length < 2) return null;

  const { data: judged } = await supabase.from("post_battles").select("post_a, post_b");
  const seen = new Set([...(judged ?? []).map((b) => matchKey(b.post_a, b.post_b)), ...skip]);

  const todayStart = Date.parse(startOfNewYorkDay());
  const isToday = (p: Candidate) => Date.parse(p.published_at) >= todayStart;
  const pairs: { a: Candidate; b: Candidate; tier: number; exposure: number }[] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const [a, b] = [usable[i], usable[j]];
      if (seen.has(matchKey(a.id, b.id))) continue;
      const tier = 2 - Number(isToday(a)) - Number(isToday(b));
      const exposure = a.battle_wins + a.battle_losses + b.battle_wins + b.battle_losses;
      pairs.push({ a, b, tier, exposure });
    }
  }
  if (pairs.length === 0) return null;

  pairs.sort((x, y) => x.tier - y.tier || x.exposure - y.exposure);
  const shortlist = pairs.filter((p) => p.tier === pairs[0].tier).slice(0, 8);
  const pick = shortlist[Math.floor(Math.random() * shortlist.length)];
  const side = ({ caption, published_at: _published, ...post }: Candidate): Contender => ({
    ...post,
    caption: caption!.text,
    mood: caption!.remix?.mood ?? null,
  });
  const [left, right] = Math.random() < 0.5 ? [side(pick.a), side(pick.b)] : [side(pick.b), side(pick.a)];
  return { left, right, remaining: pairs.length };
}

/** How many battles the member has judged today (New York time). */
export async function getBattlesToday(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("post_battles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfNewYorkDay());
  return count ?? 0;
}
