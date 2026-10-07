import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  FEED_PAGE_SIZE,
  getFeed,
  getMyVotes,
  getPreview,
  startOfNewYorkDay,
  type FeedSort,
  type Post,
} from "@/lib/battle";
import { getDailyTheme } from "@/lib/daily-theme";
import { PostCard } from "./post-card";
import { MembersWall, PreviewCard } from "./preview";
import styles from "./battle.module.css";

export const metadata: Metadata = {
  title: "Caption Battle",
  description:
    "Upload a photo, get four AI-written captions in the style you pick, and vote for the funniest. New theme every day.",
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

  const [{ user }, daily] = await Promise.all([getSession(), getDailyTheme()]);

  // Signed-out visitors can't read the board (RLS); they get a 3-post preview instead.
  let previews = user ? [] : await getPreview({ since: startOfNewYorkDay() });
  if (!user && previews.length === 0) previews = await getPreview();

  const { posts, total, error } = user
    ? await getFeed(sort, page)
    : { posts: [] as Post[], total: 0, error: null };
  const myVotes = user ? await getMyVotes(posts.flatMap((p) => p.captions.map((c) => c.id))) : new Map();
  const totalPages = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE));

  return (
    <main id="main" className={styles.main}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Caption Battle · Today&apos;s theme</p>
          <h1 className={styles.title}>
            <em>{daily.theme}</em>
          </h1>
          {daily.trend && (
            <p className={styles.trendNote}>
              Inspired by <strong>{daily.trend}</strong>, trending on X in New York today
            </p>
          )}
          <p className={styles.lede}>
            {daily.idea ? `${daily.idea} ` : ""}Post a funny photo, let AI write the captions, and vote on
            everyone else&apos;s. The theme is just an idea; any photo works.
          </p>
        </div>
        <Link href={user ? "/battle/new" : "/login"} className={styles.primary}>
          {user ? "Caption a photo" : "Sign in to play"}
        </Link>
      </header>

      <ol className={styles.howItWorks} aria-label="How it works">
        <li>
          <strong>Post a photo</strong>
          <span>Anything that made you laugh: a subway moment, your dorm, a bodega cat.</span>
        </li>
        <li>
          <strong>AI writes 4 captions</strong>
          <span>Pick a style like Sarcastic or Wholesome, and get four different jokes in seconds.</span>
        </li>
        <li>
          <strong>Everyone votes</strong>
          <span>The funniest caption rises to the top. Today&apos;s board resets at midnight.</span>
        </li>
      </ol>

      {!user ? (
        <>
          <h2 className={styles.previewTitle}>Today&apos;s highlights</h2>
          {previews.length > 0 ? (
            <div className={styles.previewGrid}>
              {previews.map((post, i) => (
                <PreviewCard key={post.id} post={post} priority={i === 0} />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Nobody&apos;s on stage yet.</p>
              <p>Sign in and be the first to post today.</p>
            </div>
          )}
          <MembersWall />
        </>
      ) : (
        <MemberFeed
          sort={sort}
          page={page}
          totalPages={totalPages}
          posts={posts}
          error={Boolean(error)}
          myVotes={myVotes}
          theme={daily.theme}
        />
      )}
    </main>
  );
}

type MemberFeedProps = {
  sort: FeedSort;
  page: number;
  totalPages: number;
  posts: Post[];
  error: boolean;
  myVotes: Map<string, 1 | -1>;
  theme: string;
};

/** The full board: every post, every caption, and voting. Members only. */
function MemberFeed({ sort, page, totalPages, posts, error, myVotes, theme }: MemberFeedProps) {
  return (
    <>
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
          <Link href="/battle/new" className={styles.secondary}>
            Caption a photo
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.feed}>
            {posts.map((post, i) => (
              <PostCard key={post.id} post={post} myVotes={myVotes} priority={i < 2} />
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
    </>
  );
}
