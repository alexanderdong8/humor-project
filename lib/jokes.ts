import { createClient } from "@/lib/supabase/server";

export type Joke = {
  id: number;
  setup: string;
  punchline: string;
  category: string | null;
  created_at: string;
};

/** Distinct joke categories, alphabetized, for the "favorite category" picker. */
export async function getJokeCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from("jokes").select("category");
  const categories = new Set((data ?? []).map((row) => row.category).filter(Boolean) as string[]);
  return [...categories].sort();
}
