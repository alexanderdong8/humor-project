import Image from "next/image";
import Link from "next/link";
import type { PostPreview } from "@/lib/battle";
import styles from "./battle.module.css";

/** A post as signed-out visitors see it: the photo and the winning caption, the rest locked. */
export function PreviewCard({ post, priority = false }: { post: PostPreview; priority?: boolean }) {
  const hidden = Math.max(0, post.caption_count - 1);

  return (
    <article className={styles.card}>
      <div className={styles.photo}>
        <Image src={post.image_url} alt="" fill sizes="(max-width: 860px) 100vw, 360px" priority={priority} />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.meta}>
          <span className={styles.author}>{post.author_name ?? "A member"}</span>
          {post.theme && (
            <span className={styles.chips}>
              <span className={styles.chip}>{post.theme}</span>
            </span>
          )}
        </div>
        {post.top_caption && (
          <div className={styles.caption} data-winner={post.top_score > 0 || undefined}>
            <div className={styles.captionText}>
              {post.top_score > 0 && <span className={styles.crown}>Crowd favorite</span>}
              <p>{post.top_caption}</p>
            </div>
          </div>
        )}
        {hidden > 0 && <LockedCaptions count={hidden} />}
      </div>
    </article>
  );
}

/** Blurred stand-ins for captions only members can read. */
export function LockedCaptions({ count }: { count: number }) {
  return (
    <Link href="/login" className={styles.locked}>
      <span className={styles.lockedBars} aria-hidden="true">
        {Array.from({ length: Math.min(count, 3) }, (_, i) => (
          <span key={i} />
        ))}
      </span>
      <span className={styles.lockedLabel}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z"
          />
        </svg>
        {count} more {count === 1 ? "caption" : "captions"}: sign in to read and vote
      </span>
    </Link>
  );
}

/** What signing in unlocks, shown below the preview. */
export function MembersWall() {
  return (
    <section className={styles.wall} aria-labelledby="wall-title">
      <div>
        <p className={styles.kicker}>Members only</p>
        <h2 id="wall-title" className={styles.wallTitle}>
          The full board is for members.
        </h2>
        <ul className={styles.wallList}>
          <li>Every post and all four captions on each one</li>
          <li>Voting, live scores, and today&apos;s leaderboard</li>
          <li>Post your own photos (10 a day)</li>
        </ul>
      </div>
      <Link href="/login" className={styles.primary}>
        Sign in with Google
      </Link>
    </section>
  );
}
