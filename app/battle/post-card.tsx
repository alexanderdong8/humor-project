import Image from "next/image";
import Link from "next/link";
import { MOODS, rankCaptions, VOICES, type Post } from "@/lib/battle";
import { VoteButtons } from "./vote-buttons";
import styles from "./battle.module.css";

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(iso: string) {
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

type Props = {
  post: Post;
  myVotes: Map<string, 1 | -1>;
  priority?: boolean;
};

export function PostMeta({ post }: { post: Pick<Post, "kind" | "author_name" | "created_at" | "theme" | "voice"> }) {
  const voice = VOICES[post.voice];
  return (
    <div className={styles.meta}>
      <span className={styles.author}>
        {post.kind === "daily" ? "🤖 Punchline AI" : (post.author_name ?? "A member")}
      </span>
      <span aria-hidden="true">·</span>
      <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
      <span className={styles.chips}>
        {post.theme && <span className={styles.chip}>{post.theme}</span>}
        <span className={styles.chip}>{voice ? `${voice.emoji} ${voice.label}` : post.voice}</span>
      </span>
    </div>
  );
}

/** Credit line for openly licensed photos on the daily AI post. */
export function PhotoCredit({ post }: { post: Pick<Post, "photo_credit" | "photo_source_url"> }) {
  if (!post.photo_credit) return null;
  return (
    <p className={styles.credit}>
      📷{" "}
      {post.photo_source_url ? (
        <a href={post.photo_source_url} target="_blank" rel="noopener noreferrer">
          {post.photo_credit}
        </a>
      ) : (
        post.photo_credit
      )}{" "}
      · via Openverse
    </p>
  );
}

/** Captions ranked best first; on the feed, just the top few. */
export function CaptionList({ post, myVotes, limit }: Omit<Props, "priority"> & { limit?: number }) {
  const ranked = rankCaptions(post.captions);
  const shown = limit ? ranked.slice(0, limit) : ranked;
  const best = ranked[0]?.score ?? 0;

  return (
    <ol className={styles.captions}>
      {shown.map((caption) => {
        const winner = best > 0 && caption.score === best;
        const mood = caption.remix ? MOODS[caption.remix.mood] : null;
        return (
          <li key={caption.id} className={styles.caption} data-winner={winner || undefined}>
            <div className={styles.captionText}>
              {(winner || mood) && (
                <span className={styles.captionTags}>
                  {winner && <span className={styles.crown}>👑 Crowd favorite</span>}
                  {mood && (
                    <span className={styles.moodTag}>
                      {mood.emoji} {mood.label} remix
                    </span>
                  )}
                </span>
              )}
              <p>{caption.text}</p>
            </div>
            <VoteButtons
              captionId={caption.id}
              upvotes={caption.upvotes}
              downvotes={caption.downvotes}
              bonus={caption.duel_wins}
              myVote={myVotes.get(caption.id) ?? 0}
            />
          </li>
        );
      })}
    </ol>
  );
}

const FEED_CAPTIONS = 4;

export function PostCard({ post, myVotes, priority = false }: Props) {
  const more = post.captions.length - FEED_CAPTIONS;
  return (
    <article className={styles.card}>
      <Link href={`/battle/${post.id}`} className={styles.photo} aria-label="Open this post">
        {post.kind === "daily" && <span className={styles.aiBadge}>🤖 Today&apos;s AI photo</span>}
        <Image src={post.image_url} alt="" fill sizes="(max-width: 860px) 100vw, 540px" priority={priority} />
      </Link>
      <div className={styles.cardBody}>
        <PostMeta post={post} />
        <PhotoCredit post={post} />
        <CaptionList post={post} myVotes={myVotes} limit={FEED_CAPTIONS} />
        <Link href={`/battle/${post.id}`} className={styles.cardFooter}>
          {more > 0 ? `See all ${post.captions.length} captions` : "Open post"} · 🔀 Remix
        </Link>
      </div>
    </article>
  );
}
