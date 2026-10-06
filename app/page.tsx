import Link from "next/link";
import { JokeCard } from "@/components/joke-card";
import { getSession } from "@/lib/auth";
import { getTopCaptionToday, themeForDate } from "@/lib/battle";
import { getJokeCategoryCounts, getJokeOfTheDay } from "@/lib/jokes";
import styles from "./page.module.css";

export default async function Home() {
  const [{ user, profile }, jokeOfTheDay, categories, topCaption] = await Promise.all([
    getSession(),
    getJokeOfTheDay(),
    getJokeCategoryCounts(),
    getTopCaptionToday(),
  ]);
  const theme = themeForDate();
  const totalJokes = categories.reduce((sum, c) => sum + c.joke_count, 0);

  return (
    <main id="main" className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Open mic, every day</p>
          <h1 className={styles.headline}>
            Jokes worth telling <em>twice.</em>
          </h1>
          <p className={styles.lede}>
            A hand-picked library of one-liners, puns, and groan-worthy classics. Read the setup,
            take a beat, then tap for the punchline.
          </p>
          <div className={styles.ctas}>
            <Link href="/jokes" className={styles.primary}>
              Browse the library
            </Link>
            <Link href={user ? "/members" : "/login"} className={styles.secondary}>
              {user ? "Go to the Green Room" : "Join the Green Room"}
            </Link>
          </div>
        </div>

        <div className={styles.stage}>
          <div className={styles.spotlight} aria-hidden="true" />
          {jokeOfTheDay && (
            <div className={styles.feature}>
              <p className={styles.onAir}>
                <span className={styles.dot} aria-hidden="true" />
                Joke of the day
              </p>
              <JokeCard joke={jokeOfTheDay} featured />
            </div>
          )}
        </div>
      </section>

      {totalJokes > 0 && (
        <dl className={styles.stats}>
          <div>
            <dt>Jokes in the library</dt>
            <dd>{totalJokes}</dd>
          </div>
          <div>
            <dt>Categories</dt>
            <dd>{categories.length}</dd>
          </div>
          <div>
            <dt>New pick</dt>
            <dd>Daily</dd>
          </div>
        </dl>
      )}

      <section className={styles.battle} aria-labelledby="battle-title">
        <div className={styles.battleCopy}>
          <p className={styles.kicker}>Caption Battle · Today</p>
          <h2 id="battle-title" className={styles.bandTitle}>
            <em>{theme}</em>
          </h2>
          <p className={styles.battleLede}>
            Snap it, upload it, and AI writes four captions in the style you pick. Everyone votes, and
            the best line wins the day.
          </p>
          <div className={styles.ctas}>
            <Link href={user ? "/battle/new" : "/login"} className={styles.primary}>
              {user ? "Caption a photo" : "Sign in to play"}
            </Link>
            <Link href="/battle" className={styles.secondary}>
              See today&apos;s board
            </Link>
          </div>
        </div>
        {topCaption ? (
          <Link href={`/battle/${topCaption.generation_id}`} className={styles.leader}>
            <span className={styles.leaderPhoto} style={{ backgroundImage: `url(${topCaption.generations.image_url})` }} />
            <span className={styles.leaderBody}>
              <span className={styles.leaderLabel}>Leading today · {topCaption.score} pts</span>
              <span className={styles.leaderText}>{topCaption.text}</span>
              <span className={styles.leaderBy}>{topCaption.generations.author_name ?? "A member"}</span>
            </span>
          </Link>
        ) : (
          <div className={styles.leaderEmpty}>
            <span className={styles.leaderLabel}>No leader yet</span>
            <p>Today&apos;s crown is up for grabs. Post the first photo.</p>
          </div>
        )}
      </section>

      {categories.length > 0 && (
        <section className={styles.section} aria-labelledby="categories-title">
          <div className={styles.sectionHead}>
            <h2 id="categories-title" className={styles.sectionTitle}>
              Pick your poison
            </h2>
            <Link href="/jokes" className={styles.textLink}>
              See all jokes →
            </Link>
          </div>
          <ul className={styles.categories}>
            {categories.map((c) => (
              <li key={c.category}>
                <Link href={`/jokes?category=${encodeURIComponent(c.category)}`} className={styles.category}>
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
        <div>
          <p className={styles.kicker}>Members only</p>
          <h2 id="green-room-title" className={styles.bandTitle}>
            {user && profile?.first_name ? (
              <>
                Your set is waiting, <em>{profile.first_name}.</em>
              </>
            ) : (
              <>
                Step into the <em>Green Room.</em>
              </>
            )}
          </h2>
        </div>
        <ul className={styles.perks}>
          <li>
            <strong>Your own set.</strong> Pick a favorite kind of joke and we&apos;ll line them up.
          </li>
          <li>
            <strong>A profile that&apos;s yours.</strong> Add your name and a photo.
          </li>
          <li>
            <strong>One click to join.</strong> Sign in with Google. No passwords to remember.
          </li>
        </ul>
        <Link href={user ? "/members" : "/login"} className={styles.primary}>
          {user ? "Enter the Green Room" : "Sign in with Google"}
        </Link>
      </section>
    </main>
  );
}
