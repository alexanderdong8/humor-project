import Image from "next/image";
import Link from "next/link";
import { VOICES, type Post } from "@/lib/battle";
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

export function PostMeta({ post }: { post: Post }) {
  return (
    <div className={styles.meta}>
      <span className={styles.author}>{post.author_name ?? "A member"}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
      <span className={styles.chips}>
        {post.theme && <span className={styles.chip}>{post.theme}</span>}
        <span className={styles.chip}>{VOICES[post.voice]?.label ?? post.voice}</span>
      </span>
    </div>
  );
}

export function CaptionList({ post, myVotes }: Omit<Props, "priority">) {
  const best = Math.max(...post.captions.map((c) => c.score));

  return (
    <ol className={styles.captions}>
      {post.captions.map((caption) => (
        <li key={caption.id} className={styles.caption} data-winner={(best > 0 && caption.score === best) || undefined}>
          <div className={styles.captionText}>
            {best > 0 && caption.score === best && <span className={styles.crown}>Crowd favorite</span>}
            <p>{caption.text}</p>
          </div>
          <VoteButtons
            captionId={caption.id}
            upvotes={caption.upvotes}
            downvotes={caption.downvotes}
            myVote={myVotes.get(caption.id) ?? 0}
          />
        </li>
      ))}
    </ol>
  );
}

export function PostCard({ post, myVotes, priority = false }: Props) {
  return (
    <article className={styles.card}>
      <Link href={`/battle/${post.id}`} className={styles.photo} aria-label="Open this post">
        <Image
          src={post.image_url}
          alt=""
          fill
          sizes="(max-width: 860px) 100vw, 540px"
          priority={priority}
        />
      </Link>
      <div className={styles.cardBody}>
        <PostMeta post={post} />
        <CaptionList post={post} myVotes={myVotes} />
      </div>
    </article>
  );
}
