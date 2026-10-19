import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MemeCard } from "@/components/meme-card";
import { Mascot } from "@/components/mascot";
import { getSession } from "@/lib/auth";
import { BOARD_PAGE_SIZE, getLeaderboard, getPreview, winRate, type BoardRange } from "@/lib/battle";
import styles from "@/components/game.module.css";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The funniest posts on Punchline, ranked by their head-to-head battle record.",
};

const TABS: { range: BoardRange; label: string }[] = [
  { range: "today", label: "🔥 Today" },
  { range: "week", label: "📅 This week" },
  { range: "all", label: "🏆 All-time" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function boardHref(range: BoardRange, page = 1) {
  const params = new URLSearchParams();
  if (range !== "week") params.set("range", range);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/top?${query}` : "/top";
}

/** Browse-only: the leaderboard shows battle results; voting happens in /battle. */
export default async function TopPage(props: PageProps<"/top">) {
  const searchParams = await props.searchParams;
  const rangeParam = first(searchParams.range);
  const range: BoardRange = rangeParam === "today" || rangeParam === "all" ? rangeParam : "week";
  const requested = Number(first(searchParams.page));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const { user } = await getSession();

  const header = (
    <header className={styles.hero}>
      <div>
        <p className={styles.kicker}>🏆 Leaderboard</p>
        <h1 className={styles.title}>
          The <em>funniest</em> posts.
        </h1>
        <p className={styles.lede}>
          Ranked by head-to-head battle record. Want to move the rankings? Vote in Battle.
        </p>
      </div>
      <Link href="/battle" className="btn btn-primary">
        ⚔️ Go battle
      </Link>
    </header>
  );

  if (!user) {
    const top = await getPreview();
    return (
      <main id="main" className={styles.main}>
        {header}
        <div className={styles.memeGrid}>
          {top.map((post, i) => (
            <MemeCard
              key={post.id}
              imageUrl={post.image_url}
              caption={post.caption}
              badge={MEDALS[i]}
              priority={i === 0}
              sizes="(max-width: 860px) 100vw, 360px"
              footer={
                <>
                  <span>by {post.author_name ?? "a member"}</span>
                  <span>
                    {post.battle_wins}W · {post.battle_losses}L
                  </span>
                </>
              }
            />
          ))}
        </div>
        <section className={styles.wall}>
          <div>
            <p className={styles.kicker}>🎤 Members only</p>
            <p className={styles.wallTitle}>See the full leaderboard.</p>
          </div>
          <Link href="/login" className="btn btn-primary">
            Sign in with Google
          </Link>
        </section>
      </main>
    );
  }

  const { posts, total, error } = await getLeaderboard(range, page);
  const totalPages = Math.max(1, Math.ceil(total / BOARD_PAGE_SIZE));
  const offset = (page - 1) * BOARD_PAGE_SIZE;

  return (
    <main id="main" className={styles.main}>
      {header}
      <nav className={styles.tabs} aria-label="Time range">
        {TABS.map((tab) => (
          <Link key={tab.range} href={boardHref(tab.range)} className={styles.tab} aria-current={tab.range === range ? "page" : undefined}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <div className={styles.empty} role="alert">
          <Mascot mood="sad" size={72} />
          <p className={styles.emptyTitle}>The mic cut out.</p>
          <p>We couldn&apos;t load the leaderboard. Please refresh in a moment.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className={styles.empty}>
          <Mascot mood="sleepy" size={72} />
          <p className={styles.emptyTitle}>{range === "today" ? "No posts yet today." : "Nothing here yet."}</p>
          <p>Post a photo and it&apos;ll show up here once people start battling it.</p>
          <Link href="/post/new" className="btn btn-secondary">
            📸 Post a photo
          </Link>
        </div>
      ) : (
        <ol className={styles.board}>
          {posts.map((post, i) => {
            const rank = offset + i;
            const rate = winRate(post.battle_wins, post.battle_losses);
            return (
              <li key={post.id}>
                <Link href={`/post/${post.id}`} className={styles.boardRow}>
                  <span className={styles.rank}>{MEDALS[rank] ?? rank + 1}</span>
                  <span className={styles.thumb}>
                    <Image src={post.image_url} alt="" fill sizes="96px" />
                  </span>
                  <span className={styles.boardText}>
                    <span className={styles.boardCaption}>{post.caption?.text ?? "…"}</span>
                    <span className={styles.boardMeta}>
                      by {post.author_name ?? "a member"}
                      {post.theme ? ` · ${post.theme}` : ""}
                    </span>
                  </span>
                  <span className={styles.winPill}>
                    <strong>{rate === null ? "New" : `${rate}%`}</strong>
                    <span>
                      {post.battle_wins}W · {post.battle_losses}L
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {totalPages > 1 && (
        <nav className={styles.pager} aria-label="Pagination">
          {page > 1 ? <Link href={boardHref(range, page - 1)}>← Higher</Link> : <span aria-disabled="true">← Higher</span>}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={boardHref(range, page + 1)}>Lower →</Link>
          ) : (
            <span aria-disabled="true">Lower →</span>
          )}
        </nav>
      )}
    </main>
  );
}
