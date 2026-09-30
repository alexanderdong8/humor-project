import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { JokeCard } from "@/components/joke-card";
import { displayName, isProfileComplete, requireUser } from "@/lib/auth";
import { JOKE_COLUMNS, type Joke } from "@/lib/jokes";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/account.module.css";

export const metadata: Metadata = {
  title: "The Green Room",
  robots: { index: false },
};

export default async function MembersPage() {
  // The proxy already bounced signed-out visitors; this is the authoritative check.
  const { user, profile } = await requireUser();
  if (!profile || !isProfileComplete(profile)) redirect("/onboarding");

  const supabase = await createClient();
  let query = supabase.from("jokes").select(JOKE_COLUMNS);
  if (profile.favorite_category) query = query.eq("category", profile.favorite_category);
  const { data: jokes } = await query.order("id").limit(6).returns<Joke[]>();

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <main id="main" className={styles.page}>
      <section className={`${styles.panel} ${styles.wide}`}>
        <div className={styles.greeting}>
          <Avatar url={profile.avatar_url} name={displayName(profile, user)} size={64} />
          <div>
            <p className={styles.kicker}>The Green Room</p>
            <h1 className={styles.title}>
              Good to see you, <em>{profile.first_name}.</em>
            </h1>
          </div>
        </div>
        <p className={styles.memberMeta}>
          <span>
            Member since <strong>{memberSince}</strong>
          </span>
          <span>
            Favorite <strong>{profile.favorite_category ?? "Anything goes"}</strong>
          </span>
        </p>

        <h2 className={styles.sectionTitle}>
          {profile.favorite_category ? `Your ${profile.favorite_category} set` : "Tonight’s set"}
        </h2>
        <ul className={styles.jokeGrid}>
          {(jokes ?? []).map((joke, i) => (
            <li key={joke.id}>
              <JokeCard joke={joke} index={i} />
            </li>
          ))}
        </ul>

        <div className={styles.actions} style={{ marginTop: "2rem" }}>
          <Link href="/jokes" className={styles.primary}>
            Browse the full library
          </Link>
          <Link href="/profile" className={styles.secondary}>
            {profile.favorite_category ? "Change your favorite" : "Pick a favorite"}
          </Link>
        </div>
      </section>
    </main>
  );
}
