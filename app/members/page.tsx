import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { displayName, isProfileComplete, requireUser } from "@/lib/auth";
import type { Joke } from "@/lib/jokes";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/account.module.css";

export const metadata: Metadata = { title: "The Green Room" };

export default async function MembersPage() {
  // The proxy already bounced signed-out visitors; this is the authoritative check.
  const { user, profile } = await requireUser();
  if (!isProfileComplete(profile)) redirect("/onboarding");

  const supabase = await createClient();
  let query = supabase.from("jokes").select("id, setup, punchline, category, created_at");
  if (profile?.favorite_category) query = query.eq("category", profile.favorite_category);
  const { data: jokes } = await query.order("id").limit(6).returns<Joke[]>();

  const name = displayName(profile, user);
  const memberSince = new Date(profile!.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.greeting}>
          <Avatar url={profile?.avatar_url ?? null} name={name} size={72} />
          <div>
            <p className={styles.eyebrow}>Members only · The Green Room</p>
            <h1 className={styles.title}>Welcome backstage, {profile?.first_name}.</h1>
          </div>
        </div>
        <p className={styles.lede}>
          Only signed-in members can see this page. You&apos;ve been a member since {memberSince}.
        </p>

        <h2 className={styles.sectionTitle}>
          {profile?.favorite_category ? `Your ${profile.favorite_category} picks` : "Tonight's set"}
        </h2>
        <ul className={styles.jokeList}>
          {(jokes ?? []).map((joke) => (
            <li key={joke.id}>
              <p className={styles.jokeSetup}>{joke.setup}</p>
              <p className={styles.jokePunchline}>{joke.punchline}</p>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <Link href="/profile" className={styles.secondary}>
            Edit profile
          </Link>
          <Link href="/jokes" className={styles.secondary}>
            All jokes
          </Link>
        </div>
      </section>
    </main>
  );
}
