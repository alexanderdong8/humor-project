import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Mascot } from "@/components/mascot";
import { MemeCard } from "@/components/meme-card";
import { getSession } from "@/lib/auth";
import { getDailyPost, getPreview, newYorkDate, startOfNewYorkDay, type Caption } from "@/lib/battle";
import { generateDailyPost } from "@/lib/daily-post";
import { getDailyTheme } from "@/lib/daily-theme";
import { getNextDailyDuel } from "@/lib/duels";
import { DailyDuel } from "./daily-duel";
import styles from "@/components/game.module.css";

export const metadata: Metadata = {
  title: "Daily AI Meme",
  description: "Every day the AI picks a meme template for the day's theme and writes four captions. You vote on the funniest.",
};

/** Captions ranked by head-to-head record (smoothed so 1-0 doesn't beat 9-1). */
function standings(captions: Caption[]) {
  const score = (c: Caption) => (c.duel_wins + 1) / (c.duel_wins + c.duel_losses + 2);
  return [...captions].sort((a, b) => score(b) - score(a) || a.position - b.position);
}

function Standings({ captions }: { captions: Caption[] }) {
  return (
    <ol className={styles.standings}>
      {standings(captions).map((c, i) => {
        const total = c.duel_wins + c.duel_losses;
        const rate = total > 0 ? Math.round((c.duel_wins / total) * 100) : null;
        return (
          <li key={c.id} className={styles.standing} data-leader={i === 0 && total > 0 ? "" : undefined}>
            <span className={styles.standingRank}>{i === 0 && total > 0 ? "👑" : i + 1}</span>
            <span className={styles.standingText}>{c.text}</span>
            <span className={styles.standingStat}>
              <span className={styles.rateBar}>
                <span style={{ width: `${rate ?? 0}%` }} />
              </span>
              {rate === null ? "No votes yet" : `${rate}% · ${total} ${total === 1 ? "matchup" : "matchups"}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default async function DailyPage() {
  const [{ user }, daily] = await Promise.all([getSession(), getDailyTheme()]);
  const today = newYorkDate();

  const header = (
    <header className={styles.hero}>
      <div>
        <p className={styles.kicker}>🤖 Daily AI Meme · {daily.theme}</p>
        <h1 className={styles.title}>
          The AI made a meme. <em>You pick the punchline.</em>
        </h1>
        <p className={styles.lede}>
          Every night the AI picks a classic meme template for the day&apos;s theme and writes 4 captions. Vote on
          pairs until the funniest one rises to the top. New meme at midnight.
        </p>
      </div>
    </header>
  );

  if (!user) {
    const [preview] = await getPreview({ kind: "daily", since: startOfNewYorkDay(), limit: 1 });
    return (
      <main id="main" className={styles.main}>
        {header}
        {preview ? (
          <div className={styles.dailySolo}>
            <MemeCard imageUrl={preview.image_url} caption={preview.caption} badge="🤖 AI meme" size="lg" priority />
            {preview.photo_credit && <p className={styles.credit}>{preview.photo_credit}</p>}
          </div>
        ) : (
          <div className={styles.empty}>
            <Mascot mood="sleepy" size={72} />
            <p className={styles.emptyTitle}>Today&apos;s meme is still cooking.</p>
          </div>
        )}
        <section className={styles.wall}>
          <div>
            <p className={styles.kicker}>🎤 Members only</p>
            <p className={styles.wallTitle}>Sign in to vote on all 4 captions.</p>
          </div>
          <Link href="/login" className="btn btn-primary">
            Sign in with Google
          </Link>
        </section>
      </main>
    );
  }

  const yesterday = newYorkDate(new Date(Date.now() - 86_400_000));
  const [post, previous] = await Promise.all([getDailyPost(today), getDailyPost(yesterday)]);

  if (!post) {
    // The nightly job hasn't made today's meme yet: make it in the background.
    if (process.env.THEME_WRITER_DB_URL) {
      after(() => generateDailyPost(today, daily).catch((error) => console.error("[daily] generation failed", error)));
    }
    return (
      <main id="main" className={styles.main}>
        {header}
        <div className={styles.empty}>
          <Mascot mood="sleepy" size={84} />
          <p className={styles.emptyTitle}>Today&apos;s meme is still cooking.</p>
          <p>The AI is picking a template and writing captions. Refresh in a minute.</p>
        </div>
      </main>
    );
  }

  const duel = await getNextDailyDuel(user.id, post.id);
  const winner = previous ? standings(previous.captions)[0] : null;

  return (
    <main id="main" className={styles.main}>
      {header}
      <DailyDuel postId={post.id} imageUrl={post.image_url} credit={post.photo_credit} initial={duel} />

      <h2 className={styles.sectionTitle}>📊 Today&apos;s standings</h2>
      <Standings captions={post.captions} />

      {previous && winner && (
        <section className={styles.yesterday} aria-labelledby="yesterday-title">
          <h2 id="yesterday-title" className={styles.sectionTitle}>
            👑 Yesterday&apos;s winner
          </h2>
          <MemeCard
            imageUrl={previous.image_url}
            caption={winner.text}
            sizes="(max-width: 860px) 100vw, 420px"
            footer={<span>{previous.theme}</span>}
          />
        </section>
      )}
    </main>
  );
}
