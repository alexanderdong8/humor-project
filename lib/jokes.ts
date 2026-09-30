import { createClient } from "@/lib/supabase/server";

export type Joke = {
  id: number;
  setup: string;
  punchline: string;
  category: string | null;
  created_at: string;
};

export type JokeCategory = { category: string; joke_count: number };

export const JOKE_COLUMNS = "id, setup, punchline, category, created_at";

/** Categories with their joke counts, alphabetized (from the joke_categories view). */
export async function getJokeCategoryCounts(): Promise<JokeCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("joke_categories").select("category, joke_count");
  return (data ?? []) as JokeCategory[];
}

/** Category names only, for pickers and validation. */
export async function getJokeCategories() {
  return (await getJokeCategoryCounts()).map((c) => c.category);
}

/** One joke per calendar day (UTC), the same for every visitor. */
export async function getJokeOfTheDay(): Promise<Joke | null> {
  const supabase = await createClient();
  const { count } = await supabase.from("jokes").select("id", { count: "exact", head: true });
  if (!count) return null;

  const day = Math.floor(Date.now() / 86_400_000);
  const index = day % count;
  const { data } = await supabase
    .from("jokes")
    .select(JOKE_COLUMNS)
    .order("id")
    .range(index, index)
    .maybeSingle<Joke>();
  return data;
}
