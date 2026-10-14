import type { CSSProperties } from "react";
import Link from "next/link";
import { JokeCard } from "@/components/joke-card";
import { Mascot } from "@/components/mascot";
import { getSession } from "@/lib/auth";
import { getTopCaptionToday } from "@/lib/battle";
import { getDailyTheme } from "@/lib/daily-theme";
import { categoryEmoji, getJokeCategoryCounts, getJokeOfTheDay } from "@/lib/jokes";
import styles from "./page.module.css";

const TILE_COLORS = ["--sun-soft", "--sky-soft", "--pink-soft", "--mint-soft", "--grape-soft", "--tomato-soft"];

export default async function Home() {
  const [{ user, profile }, jokeOfTheDay, categories, topCaption, daily] = await Promise.all([
    getSession(),
    getJokeOfTheDay(),
    getJokeCategoryCounts(),
    getTopCaptionToday(),
    getDailyTheme(),
  ]);
  const totalJokes = categories.reduce((sum, c) => sum + c.joke_count, 0);

  return (
    <main id="main" className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.sticker}>🎤 Open mic, every day</p>
          <h1 className={styles.headline}>
            Jokes worth telling <span className={styles.marker}>twice.</span>
          </h1>
          <p className={styles.lede}>
            Post a photo and AI writes the jokes. Vote on everyone else&apos;s, and crack open a library of
            puns and one-liners while you&apos;re here.
          </p>
          <div className={styles.ctas}>
            <Link href="/battle" className="btn btn-primary">
              ⚔️ Play today&apos;s battle
            </Link>
            <Link href="/jokes" className="btn btn-secondary">
              📚 Browse jokes
            </Link>
          </div>
          {totalJokes > 0 && (
            <ul className={styles.facts} aria-label="At a glance">
              <li>
                <strong>{totalJokes}</strong> jokes
              </li>
              <li>
                <strong>{categories.length}</strong> categories
              </li>
              <li>
                <strong>1</strong> new theme a day
              </li>
            </ul>
          )}
        </div>

        <div className={styles.stage}>
          <Mascot mood="laughing" size={120} className={styles.mascot} />
          <span className={`${styles.burst} ${styles.burstHa}`} aria-hidden="true">
            HA!
          </span>
          <span className={`${styles.burst} ${styles.burstLol}`} aria-hidden="true">
            LOL
          </span>
          {jokeOfTheDay && (
            <div className={styles.feature}>
              <p className={styles.badge}>⭐ Joke of the day</p>
              <JokeCard joke={jokeOfTheDay} featured />
            </div>
          )}
        </div>
      </section>

      <section className={styles.battle} aria-labelledby="battle-title">
        <div className={styles.battleCopy}>
          <p className={styles.kicker}>⚔️ Caption Battle · Today&apos;s theme</p>
          <h2 id="battle-title" className={styles.battleTitle}>
            {daily.theme}
          </h2>
          {daily.trend && (
            <p className={styles.trend}>
              📈 Inspired by <strong>{daily.trend}</strong>, trending on X in New York
            </p>
          )}
          <ol className={styles.steps}>
            <li>
              <span>📸</span> Post a funny photo
            </li>
            <li>
              <span>🤖</span> AI writes 4 captions
            </li>
            <li>
              <span>😂</span> Everyone votes
            </li>
          </ol>
          <div className={styles.ctas}>
            <Link href={user ? "/battle/new" : "/login"} className="btn btn-primary">
              {user ? "Caption a photo" : "Sign in to play"}
            </Link>
            <Link href="/battle" className="btn btn-secondary">
              See the board
            </Link>
          </div>
        </div>
        {topCaption ? (
          <Link href={`/battle/${topCaption.id}`} className={styles.leader}>
            <span className={styles.leaderBadge}>👑 Leading today · {topCaption.top_score} pts</span>
            <span className={styles.leaderPhoto} style={{ backgroundImage: `url(${topCaption.image_url})` }} />
            <span className={styles.leaderText}>“{topCaption.top_caption}”</span>
            <span className={styles.leaderBy}>by {topCaption.author_name ?? "a member"}</span>
          </Link>
        ) : (
          <div className={styles.leaderEmpty}>
            <Mascot mood="wow" size={72} />
            <p className={styles.leaderEmptyTitle}>The crown is up for grabs!</p>
            <p>Nobody&apos;s posted today. Be the first.</p>
          </div>
        )}
      </section>

      {categories.length > 0 && (
        <section className={styles.section} aria-labelledby="categories-title">
          <div className={styles.sectionHead}>
            <h2 id="categories-title" className={styles.sectionTitle}>
              Pick your flavor
            </h2>
            <Link href="/jokes" className={styles.textLink}>
              See all jokes →
            </Link>
          </div>
          <ul className={styles.categories}>
            {categories.map((c, i) => (
              <li key={c.category}>
                <Link
                  href={`/jokes?category=${encodeURIComponent(c.category)}`}
                  className={styles.category}
                  style={{ "--tile": `var(${TILE_COLORS[i % TILE_COLORS.length]})` } as CSSProperties}
                >
                  <span className={styles.categoryEmoji} aria-hidden="true">
                    {categoryEmoji(c.category)}
                  </span>
                  <span className={styles.categoryName}>{c.category}</span>
                  <span className={styles.categoryCount}>
                    {c.joke_count} {c.joke_count === 1 ? "joke" : "jokes"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.band} aria-labelledby="green-room-title">
        <Mascot mood="happy" size={88} className={styles.bandMascot} />
        <div className={styles.bandCopy}>
          <p className={styles.kicker}>🎤 Members only</p>
          <h2 id="green-room-title" className={styles.bandTitle}>
            {user && profile?.first_name ? `Your set is waiting, ${profile.first_name}!` : "Come hang in the Green Room."}
          </h2>
          <ul className={styles.perks}>
            <li>Vote on every caption and climb today&apos;s board</li>
            <li>Post up to 10 photos a day</li>
            <li>A joke set picked for your sense of humor</li>
          </ul>
        </div>
        <Link href={user ? "/members" : "/login"} className="btn btn-primary">
          {user ? "Enter the Green Room" : "Sign in with Google"}
        </Link>
      </section>
    </main>
  );
}
