import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MemeCard } from "@/components/meme-card";
import { getBattlesToday, getNextMatchup } from "@/lib/arena";
import { getSession, isProfileComplete } from "@/lib/auth";
import { getPreview, winRate } from "@/lib/battle";
import { getDailyTheme, trendSourceLabel } from "@/lib/daily-theme";
import { Arena } from "./arena";
import styles from "@/components/game.module.css";

export const metadata: Metadata = {
  title: "Battle",
  description: "Two photos, each with one caption. Tap the funnier post; every pick moves the leaderboard.",
};

export default async function BattlePage() {
  const [{ user, profile }, daily] = await Promise.all([getSession(), getDailyTheme()]);
  if (user && !isProfileComplete(profile)) redirect("/onboarding");

  const header = (
    <header className={styles.hero}>
      <div>
        <p className={styles.kicker}>⚔️ Battle · Today&apos;s theme: {daily.theme}</p>
        <h1 className={styles.title}>
          Which post is <em>funnier?</em>
        </h1>
        <p className={styles.lede}>
          Each post is a photo and the one caption its owner picked. Tap the funnier one; every pick counts toward
          the leaderboard.
        </p>
        {daily.trend && (
          <p className={styles.trendNote}>
            📈 Theme inspired by <strong>{daily.trend}</strong>, {trendSourceLabel(daily.source)}
          </p>
        )}
      </div>
      <div className={styles.heroActions}>
        <Link href={user ? "/post/new" : "/login"} className="btn btn-primary">
          📸 Post a photo
        </Link>
        <Link href="/top" className="btn btn-secondary">
          🏆 Leaderboard
        </Link>
      </div>
    </header>
  );

  if (!user) {
    const top = await getPreview();
    return (
      <main id="main" className={styles.main}>
        {header}
        <ol className={styles.howItWorks} aria-label="How it works">
          <li>
            <span className={styles.howEmoji}>📸</span>
            <strong>Post a photo</strong>
            <span>The AI writes 4 captions for it.</span>
          </li>
          <li>
            <span className={styles.howEmoji}>🏆</span>
            <strong>Pick your caption</strong>
            <span>Knock them out two at a time. Only the winner goes on your photo.</span>
          </li>
          <li>
            <span className={styles.howEmoji}>⚔️</span>
            <strong>Battle</strong>
            <span>Posts go head-to-head. Everyone votes for the funnier one.</span>
          </li>
        </ol>
        {top.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>🏆 Top posts right now</h2>
            <div className={styles.memeGrid}>
              {top.map((post, i) => {
                const rate = winRate(post.battle_wins, post.battle_losses);
                return (
                  <MemeCard
                    key={post.id}
                    imageUrl={post.image_url}
                    caption={post.caption}
                    priority={i === 0}
                    sizes="(max-width: 860px) 100vw, 360px"
                    footer={
                      <>
                        <span>by {post.author_name ?? "a member"}</span>
                        <span>
                          {post.battle_wins}W · {post.battle_losses}L{rate !== null ? ` · ${rate}%` : ""}
                        </span>
                      </>
                    }
                  />
                );
              })}
            </div>
          </>
        )}
        <section className={styles.wall} aria-labelledby="wall-title">
          <div>
            <p className={styles.kicker}>🎤 Members only</p>
            <h2 id="wall-title" className={styles.wallTitle}>
              Sign in to battle.
            </h2>
            <ul className={styles.wallList}>
              <li>Vote in head-to-head battles and move the leaderboard</li>
              <li>Post your own photos (10 a day) and pick their captions</li>
              <li>Battle the captions on today&apos;s AI meme</li>
            </ul>
          </div>
          <Link href="/login" className="btn btn-primary">
            Sign in with Google
          </Link>
        </section>
      </main>
    );
  }

  const [matchup, judgedToday] = await Promise.all([getNextMatchup(user.id), getBattlesToday(user.id)]);
  return (
    <main id="main" className={styles.main}>
      {header}
      <Arena initial={matchup} judgedToday={judgedToday} />
    </main>
  );
}
