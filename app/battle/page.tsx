import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { FEED_PAGE_SIZE, getFeed, getMyVotes, themeForDate, type FeedSort } from "@/lib/battle";
import { PostCard } from "./post-card";
import styles from "./battle.module.css";

export const metadata: Metadata = {
  title: "Caption Battle",
  description:
    "Upload a photo, get four AI-written captions in the voice you pick, and vote for the funniest. New theme every day.",
};

const TABS: { sort: FeedSort; label: string }[] = [
  { sort: "today", label: "Today's top" },
  { sort: "new", label: "New" },
  { sort: "top", label: "All-time" },
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function feedHref(sort: FeedSort, page = 1) {
  const params = new URLSearchParams();
  if (sort !== "today") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/battle?${query}` : "/battle";
}

export default async function BattlePage(props: PageProps<"/battle">) {
  const searchParams = await props.searchParams;
  const sortParam = first(searchParams.sort);
  const sort: FeedSort = sortParam === "new" || sortParam === "top" ? sortParam : "today";
  const requested = Number(first(searchParams.page));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const [{ user }, { posts, total, error }] = await Promise.all([getSession(), getFeed(sort, page)]);
  const myVotes = user ? await getMyVotes(posts.flatMap((p) => p.captions.map((c) => c.id))) : new Map();
  const totalPages = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE));
  const theme = themeForDate();

  return (
    <main id="main" className={styles.main}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Caption Battle · Today&apos;s theme</p>
          <h1 className={styles.title}>
            <em>{theme}</em>
          </h1>
          <p className={styles.lede}>
            Upload a photo and our AI writes four captions in the voice you pick. Everyone votes, and the
            funniest line wins the day. The board resets at midnight.
          </p>
        </div>
        <Link href={user ? "/battle/new" : "/login"} className={styles.primary}>
          {user ? "Caption a photo" : "Sign in to play"}
        </Link>
      </header>

      <nav className={styles.tabs} aria-label="Sort posts">
        {TABS.map((tab) => (
          <Link
            key={tab.sort}
            href={feedHref(tab.sort)}
            className={styles.tab}
            aria-current={tab.sort === sort ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <div className={styles.empty} role="alert">
          <p className={styles.emptyTitle}>The mic cut out.</p>
          <p>We couldn&apos;t load the battle right now. Please refresh in a moment.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{sort === "today" ? "Nobody's on stage yet." : "Tough crowd."}</p>
          <p>
            {sort === "today"
              ? `Be the first to caption “${theme}” today.`
              : "No posts yet. Be the first to start the battle."}
          </p>
          <Link href={user ? "/battle/new" : "/login"} className={styles.secondary}>
            {user ? "Caption a photo" : "Sign in to play"}
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.feed}>
            {posts.map((post, i) => (
              <PostCard key={post.id} post={post} myVotes={myVotes} signedIn={Boolean(user)} priority={i < 2} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className={styles.pager} aria-label="Pagination">
              {page > 1 ? (
                <Link href={feedHref(sort, page - 1)} rel="prev">
                  ← Newer
                </Link>
              ) : (
                <span aria-disabled="true">← Newer</span>
              )}
              <span>
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={feedHref(sort, page + 1)} rel="next">
                  Older →
                </Link>
              ) : (
                <span aria-disabled="true">Older →</span>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
