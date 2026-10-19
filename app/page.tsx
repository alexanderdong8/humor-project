import type { CSSProperties } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { JokeCard } from "@/components/joke-card";
import { Mascot } from "@/components/mascot";
import { getBattlesToday, getNextMatchup } from "@/lib/arena";
import { getSession, type Profile } from "@/lib/auth";
import { DAILY_POST_LIMIT, getDailyPost, getMyPosts, getTopPostToday, winRate, type PostPreview } from "@/lib/battle";
import { getDailyTheme, type DailyTheme } from "@/lib/daily-theme";
import { getNextDailyDuel } from "@/lib/duels";
import { categoryEmoji, getJokeCategoryCounts, getJokeOfTheDay, type JokeCategory } from "@/lib/jokes";
import { createClient } from "@/lib/supabase/server";
import { DashboardView, plural, TrendNote } from "./member-dashboard";
import styles from "./page.module.css";

const TILE_COLORS = ["--sun-soft", "--sky-soft", "--pink-soft", "--mint-soft", "--grape-soft", "--tomato-soft"];

/**
 * Signed out, home is the pitch. Signed in, it's the member's dashboard: what's
 * waiting for them today, their uploads, today's leader, and the joke library.
 */
export default async function Home() {
  const [{ user, profile }, jokeOfTheDay, categories, leader, daily] = await Promise.all([
    getSession(),
    getJokeOfTheDay(),
    getJokeCategoryCounts(),
    getTopPostToday(),
    getDailyTheme(),
  ]);

  if (user) {
    return (
      <main id="main" className={styles.main}>
        <Dashboard user={user} profile={profile} daily={daily} />
        <section className={`${styles.split} ${styles.tight}`}>
          <div>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitleSm}>🏆 Top upload today</h2>
              <Link href="/top" className={styles.textLink}>
                Leaderboard →
              </Link>
            </div>
            <LeaderCard leader={leader} />
          </div>
          {jokeOfTheDay && (
            <div>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitleSm}>⭐ Joke of the day</h2>
                <Link href="/jokes" className={styles.textLink}>
                  Joke library →
                </Link>
              </div>
              <JokeCard joke={jokeOfTheDay} featured />
            </div>
          )}
        </section>
        <Categories categories={categories} tight />
      </main>
    );
  }

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
            Upload a photo, let AI write four captions, and battle them until one wins. Then vote on everyone
            else&apos;s uploads, judge the daily AI meme, and crack open a library of puns while you&apos;re here.
          </p>
          <div className={styles.ctas}>
            <Link href="/login" className="btn btn-primary">
              Sign in to play
            </Link>
            <Link href="/daily" className="btn btn-secondary">
              🤖 Today&apos;s AI meme
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
          <p className={styles.kicker}>📸 Upload · Today&apos;s theme</p>
          <h2 id="battle-title" className={styles.battleTitle}>
            {daily.theme}
          </h2>
          <TrendNote daily={daily} />
          <ol className={styles.steps}>
            <li>
              <span>📸</span> Upload a photo
            </li>
            <li>
              <span>⚔️</span> Battle its 4 AI captions
            </li>
            <li>
              <span>🏆</span> Keep the winner
            </li>
          </ol>
          <div className={styles.ctas}>
            <Link href="/upload" className="btn btn-primary">
              📸 How uploading works
            </Link>
            <Link href="/top" className="btn btn-secondary">
              🏆 See the leaderboard
            </Link>
          </div>
        </div>
        <LeaderCard leader={leader} />
      </section>

      <Categories categories={categories} />

      <section className={styles.band} aria-labelledby="join-title">
        <Mascot mood="happy" size={88} className={styles.bandMascot} />
        <div className={styles.bandCopy}>
          <p className={styles.kicker}>🎤 Free with Google</p>
          <h2 id="join-title" className={styles.bandTitle}>
            Grab the mic.
          </h2>
          <ul className={styles.perks}>
            <li>Upload up to 10 photos a day and battle their AI captions</li>
            <li>Vote on everyone&apos;s uploads and move the leaderboard</li>
            <li>Judge all four captions on the daily AI meme</li>
          </ul>
        </div>
        <Link href="/login" className="btn btn-primary">
          Sign in with Google
        </Link>
      </section>
    </main>
  );
}

/** Everything a member can do today, with what's waiting in each place. */
async function Dashboard({ user, profile, daily }: { user: User; profile: Profile | null; daily: DailyTheme }) {
  const supabase = await createClient();
  const [matchup, votedToday, dailyPost, posts, { data: usedToday }] = await Promise.all([
    getNextMatchup(user.id),
    getBattlesToday(user.id),
    getDailyPost(),
    getMyPosts(user.id),
    supabase.rpc("my_generations_today"),
  ]);
  const duel = dailyPost ? await getNextDailyDuel(dailyPost.id) : null;

  return (
    <DashboardView
      firstName={profile?.first_name || "there"}
      daily={daily}
      uploadsLeft={Math.max(0, DAILY_POST_LIMIT - (usedToday ?? 0))}
      draftId={posts.find((p) => p.status === "draft")?.id ?? null}
      waiting={matchup?.remaining ?? 0}
      votedToday={votedToday}
      dailyImage={dailyPost?.image_url ?? null}
      pairsLeft={duel?.remaining ?? 0}
      posts={posts}
    />
  );
}

function LeaderCard({ leader }: { leader: PostPreview | null }) {
  if (!leader) {
    return (
      <div className={styles.leaderEmpty}>
        <Mascot mood="wow" size={72} />
        <p className={styles.leaderEmptyTitle}>The crown is up for grabs!</p>
        <p>No upload has won a vote today. Yours could be first.</p>
      </div>
    );
  }
  const rate = winRate(leader.battle_wins, leader.battle_losses);
  return (
    <Link href={`/post/${leader.id}`} className={styles.leader}>
      <span className={styles.leaderBadge}>
        👑 Leading today · {leader.battle_wins}W–{leader.battle_losses}L{rate !== null ? ` · ${rate}%` : ""}
      </span>
      <span className={styles.leaderPhoto} style={{ backgroundImage: `url(${leader.image_url})` }} />
      <span className={styles.leaderText}>“{leader.caption}”</span>
      <span className={styles.leaderBy}>by {leader.author_name ?? "a member"}</span>
    </Link>
  );
}

function Categories({ categories, tight = false }: { categories: JokeCategory[]; tight?: boolean }) {
  if (categories.length === 0) return null;
  return (
    <section className={`${styles.section} ${tight ? styles.tight : ""}`} aria-labelledby="categories-title">
      <div className={styles.sectionHead}>
        <h2 id="categories-title" className={tight ? styles.sectionTitleSm : styles.sectionTitle}>
          {tight ? "📚 Pick your flavor" : "Pick your flavor"}
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
              <span className={styles.categoryCount}>{plural(c.joke_count, "joke")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
