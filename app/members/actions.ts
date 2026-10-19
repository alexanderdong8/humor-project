"use server";

import { revalidatePath } from "next/cache";
import { getJokeCategories } from "@/lib/jokes";
import { createClient } from "@/lib/supabase/server";

/** Sets (or clears, with null) the member's favorite joke category for their Green Room set. */
export async function setFavoriteCategory(category: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in." };

  if (category !== null && !(await getJokeCategories()).includes(category)) {
    return { error: "That category doesn't exist." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ favorite_category: category, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    console.error("[members] saving favorite failed", error);
    return { error: "Couldn't save your pick. Try again." };
  }

  revalidatePath("/members");
  return {};
}
