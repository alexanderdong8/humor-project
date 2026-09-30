import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  favorite_category: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type Session = { user: User; profile: Profile | null } | { user: null; profile: null };

/** The signed-in user and their profile row, fetched once per request. */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { user, profile };
});

/** Redirects to /login unless someone is signed in. */
export async function requireUser() {
  const session = await getSession();
  if (!session.user) redirect("/login");
  return session;
}

export function isProfileComplete(profile: Profile | null) {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}

export function displayName(profile: Profile | null, user: User) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  return name || user.email || "Member";
}
