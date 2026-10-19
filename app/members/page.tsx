import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { JokeCard } from "@/components/joke-card";
import { displayName, isProfileComplete, requireUser } from "@/lib/auth";
import { getMyPosts, winRate } from "@/lib/battle";
import { categoryEmoji, getJokeCategories, JOKE_COLUMNS, type Joke } from "@/lib/jokes";
import { createClient } from "@/lib/supabase/server";
import { FavoritePicker } from "./favorite-picker";
import styles from "@/components/account.module.css";

export const metadata: Metadata = {
  title: "The Green Room",
  robots: { index: false },
};

/** The member's home base: their joke set, their uploads and vote records, and shortcuts. */
export default async function MembersPage() {
  // The proxy already bounced signed-out visitors; this is the authoritative check.
  const { user, profile } = await requireUser();
  if (!profile || !isProfileComplete(profile)) redirect("/onboarding");

  const supabase = await createClient();
  let query = supabase.from("jokes").select(JOKE_COLUMNS);
  if (profile.favorite_category) query = query.eq("category", profile.favorite_category);
  const [{ data: jokes }, categories, posts] = await Promise.all([
    query.order("id").limit(6).returns<Joke[]>(),
    getJokeCategories(),
    getMyPosts(user.id),
  ]);

  return (
    <main id="main" className={styles.page}>
      <section className={`${styles.panel} ${styles.wide}`}>
        <div className={styles.greeting}>
          <Avatar url={profile.avatar_url} name={displayName(profile, user)} size={64} />
          <div>
            <p className={styles.kicker}>🎤 The Green Room</p>
            <h1 className={styles.title}>
              Good to see you, <em>{profile.first_name}.</em>
            </h1>
          </div>
        </div>

        <details className={styles.help}>
          <summary>
            <span aria-hidden="true">ⓘ</span> What is the Green Room?
          </summary>
          <div>
            <p>
              In comedy, the green room is where performers hang out backstage. Here it&apos;s your home base:
            </p>
            <ul>
              <li>
                <strong>Your joke set:</strong> pick a favorite kind of joke below and we&apos;ll line up jokes from it.
                Tap the card to reveal each punchline.
              </li>
              <li>
                <strong>Your uploads:</strong> every photo you&apos;ve uploaded, its winning caption, and how it&apos;s
                doing in Vote. Open one to remix its caption.
              </li>
              <li>
                <strong>Shortcuts</strong> to Upload, Vote, and the Daily AI Meme.
              </li>
            </ul>
          </div>
        </details>

        <div className={styles.shortcuts}>
          <Link href="/upload" className="btn btn-primary">
            📸 Upload
          </Link>
          <Link href="/vote" className="btn btn-secondary">
            🗳️ Vote
          </Link>
          <Link href="/daily" className="btn btn-secondary">
            🤖 Daily meme
          </Link>
          <Link href="/profile" className="btn btn-secondary">
            ✏️ Edit profile
          </Link>
        </div>

        <section className={styles.block} aria-labelledby="set-title">
          <h2 id="set-title" className={styles.sectionTitle}>
            🎯 Your joke set
          </h2>
          <p className={styles.blockLede}>
            Pick the kind of joke you like best and this set fills up with it. Change it anytime; it saves as soon as you
            tap.
          </p>
          <FavoritePicker
            categories={categories.map((name) => ({ name, emoji: categoryEmoji(name) }))}
            current={profile.favorite_category}
          />
          <ul className={styles.jokeGrid}>
            {(jokes ?? []).map((joke, i) => (
              <li key={joke.id}>
                <JokeCard joke={joke} index={i} />
              </li>
            ))}
          </ul>
          <Link href={profile.favorite_category ? `/jokes?category=${encodeURIComponent(profile.favorite_category)}` : "/jokes"} className={styles.textLink}>
            See all {profile.favorite_category ? `${profile.favorite_category} ` : ""}jokes →
          </Link>
        </section>

        <section className={styles.block} aria-labelledby="posts-title">
          <h2 id="posts-title" className={styles.sectionTitle}>
            📸 Your uploads
          </h2>
          {posts.length === 0 ? (
            <p className={styles.blockLede}>
              You haven&apos;t uploaded yet. <Link href="/upload">Upload a photo</Link>, battle its captions, and keep the
              winner.
            </p>
          ) : (
            <ul className={styles.myPosts}>
              {posts.map((post) => {
                const rate = winRate(post.battle_wins, post.battle_losses);
                const draft = post.status === "draft";
                return (
                  <li key={post.id}>
                    <Link href={draft ? `/post/${post.id}/pick` : `/post/${post.id}`} className={styles.myPost}>
                      <span className={styles.myThumb}>
                        <Image src={post.image_url} alt="" fill sizes="72px" />
                      </span>
                      <span className={styles.myText}>
                        <span className={styles.myCaption}>
                          {draft ? "Draft: finish the caption battle to post it" : (post.caption?.text ?? "…")}
                        </span>
                        <span className={styles.myMeta}>
                          {draft
                            ? "Not live yet"
                            : `${post.battle_wins}W · ${post.battle_losses}L${rate !== null ? ` · ${rate}% win rate` : " · no votes yet"}`}
                        </span>
                      </span>
                      <span className={styles.myGo} aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
