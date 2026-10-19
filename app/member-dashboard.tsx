import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { winRate, type BoardPost } from "@/lib/battle";
import { trendSourceLabel, type DailyTheme } from "@/lib/daily-theme";
import styles from "./page.module.css";

/** Uploads shown before "Show all". */
const UPLOADS_SHOWN = 6;

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function TrendNote({ daily }: { daily: DailyTheme }) {
  if (!daily.trend) return null;
  return (
    <p className={styles.trend}>
      📈 Inspired by <strong>{daily.trend}</strong>, {trendSourceLabel(daily.source)}
    </p>
  );
}

type DashboardProps = {
  firstName: string;
  daily: DailyTheme;
  uploadsLeft: number;
  /** An upload still waiting on its caption battle, if any. */
  draftId: string | null;
  /** Upload-vs-upload matchups the member hasn't voted on. */
  waiting: number;
  votedToday: number;
  /** Today's AI meme, or null while it's still being made. */
  dailyImage: string | null;
  pairsLeft: number;
  posts: BoardPost[];
};

/** The signed-in home page: what's waiting today, then the member's uploads. */
export function DashboardView({
  firstName,
  daily,
  uploadsLeft,
  draftId,
  waiting,
  votedToday,
  dailyImage,
  pairsLeft,
  posts,
}: DashboardProps) {
  return (
    <>
      <section className={styles.dash} aria-labelledby="dash-title">
        <div className={styles.dashHead}>
          <div>
            <p className={styles.kicker}>👋 Hey {firstName} · Today&apos;s theme</p>
            <h1 id="dash-title" className={styles.dashTitle}>
              {daily.theme}
            </h1>
            <TrendNote daily={daily} />
          </div>
          <Mascot mood="laughing" size={84} className={styles.dashMascot} />
        </div>

        <ul className={styles.actions} aria-label="Today">
          <li>
            {draftId ? (
              <ActionCard
                href={`/post/${draftId}/pick`}
                tile="--sun-soft"
                emoji="⚔️"
                stat="1"
                statLabel="draft"
                title="Finish your caption battle"
                text="An upload is waiting for you to pick its winning caption. It isn't live until you do."
                go="Finish it →"
              />
            ) : (
              <ActionCard
                href="/upload"
                tile="--sun-soft"
                emoji="📸"
                stat={String(uploadsLeft)}
                statLabel="left today"
                title="Upload a photo"
                text={
                  uploadsLeft > 0
                    ? "AI writes 4 captions, you battle them, the winner goes live."
                    : "You've used all 10 uploads today. New ones at midnight."
                }
                go={uploadsLeft > 0 ? "Upload →" : "See how it works →"}
              />
            )}
          </li>
          <li>
            <ActionCard
              href={waiting > 0 ? "/vote" : "/top"}
              tile="--sky-soft"
              emoji="🗳️"
              stat={String(waiting)}
              statLabel={waiting === 1 ? "matchup" : "matchups"}
              title={waiting > 0 ? "Vote on uploads" : "You're all caught up"}
              text={
                waiting > 0
                  ? `Two uploads at a time; tap the funnier one. ${votedToday > 0 ? `You've cast ${plural(votedToday, "vote")} today.` : "Every vote moves the leaderboard."}`
                  : "You've voted on every matchup. See where everything landed."
              }
              go={waiting > 0 ? "Vote →" : "Leaderboard →"}
            />
          </li>
          <li>
            <ActionCard
              href="/daily"
              tile="--grape-soft"
              emoji="🤖"
              stat={dailyImage ? String(pairsLeft) : "…"}
              statLabel={pairsLeft === 1 ? "pair left" : "pairs left"}
              title="Daily AI meme"
              text={
                !dailyImage
                  ? "Today's meme is still cooking. Check back in a minute."
                  : pairsLeft > 0
                    ? "The AI wrote 4 captions for today's meme. Pick the funnier of each pair."
                    : "You've judged every pair today. See which caption is winning."
              }
              go={pairsLeft > 0 ? "Judge captions →" : "See standings →"}
              thumb={dailyImage ?? undefined}
            />
          </li>
        </ul>
      </section>

      <section className={`${styles.section} ${styles.tight}`} id="your-uploads" aria-labelledby="uploads-title">
        <div className={styles.sectionHead}>
          <h2 id="uploads-title" className={styles.sectionTitleSm}>
            📸 Your uploads
          </h2>
          {posts.length > 0 && (
            <Link href="/upload" className={styles.textLink}>
              + New upload
            </Link>
          )}
        </div>
        {posts.length === 0 ? (
          <div className={styles.uploadsEmpty}>
            <Mascot mood="wow" size={64} />
            <p>
              <strong>Nothing here yet.</strong> Upload a photo, battle its 4 AI captions, and keep the winner. It shows
              up here with its vote record.
            </p>
            <Link href="/upload" className="btn btn-primary">
              📸 Upload a photo
            </Link>
          </div>
        ) : (
          <>
            <ul className={styles.uploads}>
              {posts.slice(0, UPLOADS_SHOWN).map((post) => (
                <UploadTile key={post.id} post={post} />
              ))}
            </ul>
            {posts.length > UPLOADS_SHOWN && (
              <details className={styles.more}>
                <summary>Show all {posts.length} uploads</summary>
                <ul className={styles.uploads}>
                  {posts.slice(UPLOADS_SHOWN).map((post) => (
                    <UploadTile key={post.id} post={post} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>
    </>
  );
}

type ActionCardProps = {
  href: string;
  tile: string;
  emoji: string;
  stat: string;
  statLabel: string;
  title: string;
  text: string;
  go: string;
  thumb?: string;
};

function ActionCard({ href, tile, emoji, stat, statLabel, title, text, go, thumb }: ActionCardProps) {
  return (
    <Link href={href} className={styles.action} style={{ "--tile": `var(${tile})` } as CSSProperties}>
      <span className={styles.actionTop}>
        <span className={styles.actionEmoji} aria-hidden="true">
          {emoji}
        </span>
        {thumb ? (
          <span className={styles.actionThumb}>
            <Image src={thumb} alt="" fill sizes="64px" />
          </span>
        ) : null}
        <span className={styles.actionStat}>
          <strong>{stat}</strong> {statLabel}
        </span>
      </span>
      <strong className={styles.actionTitle}>{title}</strong>
      <span className={styles.actionText}>{text}</span>
      <span className={styles.actionGo}>{go}</span>
    </Link>
  );
}

function UploadTile({ post }: { post: BoardPost }) {
  const draft = post.status === "draft";
  const rate = winRate(post.battle_wins, post.battle_losses);
  return (
    <li>
      <Link href={draft ? `/post/${post.id}/pick` : `/post/${post.id}`} className={styles.upload}>
        <span className={styles.uploadPhoto}>
          <Image src={post.image_url} alt="" fill sizes="(max-width: 600px) 50vw, 180px" />
          <span className={styles.uploadBadge} data-draft={draft || undefined}>
            {draft ? "Draft" : rate === null ? "New" : `${rate}% wins`}
          </span>
        </span>
        <span className={styles.uploadCaption}>
          {draft ? "Finish the caption battle to post it" : (post.caption?.text ?? "…")}
        </span>
        <span className={styles.uploadMeta}>
          {draft ? "Not live yet →" : `${post.battle_wins}W · ${post.battle_losses}L`}
        </span>
      </Link>
    </li>
  );
}
