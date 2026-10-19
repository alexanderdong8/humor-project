import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MemeCard } from "@/components/meme-card";
import { ShareButton } from "@/components/share-button";
import { getSession } from "@/lib/auth";
import { chosenCaption, getPost, getPreview, VOICES, winRate } from "@/lib/battle";
import { deletePost } from "../actions";
import { RemixPanel } from "./remix-panel";
import styles from "@/components/game.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Published posts are public through the preview function (link unfurlers never sign in). */
async function loadPreview(id: string) {
  if (!UUID.test(id)) return null;
  const [preview] = await getPreview({ post: id, limit: 1 });
  return preview ?? null;
}

export async function generateMetadata(props: PageProps<"/post/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const preview = await loadPreview(id);
  if (!preview) return { title: "Post not found" };
  const title = preview.caption ? `“${preview.caption}”` : "Punchline";
  return {
    title,
    description: "A photo, its winning caption, and its vote record on Punchline.",
    openGraph: { title, images: [{ url: preview.image_url }] },
    twitter: { card: "summary_large_image", title, images: [preview.image_url] },
  };
}

function BattleRecordCard({ wins, losses }: { wins: number; losses: number }) {
  const rate = winRate(wins, losses);
  return (
    <div className={styles.recordCard}>
      <div>
        <strong>{wins}</strong>
        <span>{wins === 1 ? "win" : "wins"}</span>
      </div>
      <div>
        <strong>{losses}</strong>
        <span>{losses === 1 ? "loss" : "losses"}</span>
      </div>
      <div>
        <strong>{rate === null ? "—" : `${rate}%`}</strong>
        <span>win rate</span>
      </div>
    </div>
  );
}

export default async function PostPage(props: PageProps<"/post/[id]">) {
  const [{ id }, searchParams, { user }] = await Promise.all([props.params, props.searchParams, getSession()]);

  if (!user) {
    const preview = await loadPreview(id);
    if (!preview) notFound();
    if (preview.kind === "daily") redirect("/daily");
    return (
      <main id="main" className={styles.main}>
        <article className={styles.detail}>
          <MemeCard imageUrl={preview.image_url} caption={preview.caption} size="lg" priority />
          <div className={styles.detailBody}>
            <p className={styles.kicker}>📸 by {preview.author_name ?? "a member"}</p>
            <h1 className={styles.detailTitle}>How funny is this?</h1>
            <BattleRecordCard wins={preview.battle_wins} losses={preview.battle_losses} />
            <p className={styles.hint}>Members vote on uploads two at a time. Sign in to vote and upload your own.</p>
            <div className={styles.detailActions}>
              <Link href="/login" className="btn btn-primary">
                Sign in to vote
              </Link>
              <ShareButton />
            </div>
          </div>
        </article>
      </main>
    );
  }

  const post = UUID.test(id) ? await getPost(id) : null;
  if (!post) notFound();
  if (post.kind === "daily") redirect("/daily");
  const isOwner = post.user_id === user.id;
  if (post.status === "draft") redirect(`/post/${post.id}/pick`);

  const caption = chosenCaption(post);
  const pendingRemix = isOwner && post.captions.length > 1;
  const voice = VOICES[post.voice];

  return (
    <main id="main" className={styles.main}>
      {searchParams.new === "1" && isOwner && (
        <p className={styles.notice} role="status">
          🎉 Your caption won its battle and your upload is live. Share it so people vote!
        </p>
      )}
      {searchParams.remixed === "1" && isOwner && (
        <p className={styles.notice} role="status">
          🔀 Remix done. Your photo has its winning caption.
        </p>
      )}
      {pendingRemix && (
        <p className={styles.notice} role="status">
          You have an unfinished remix. <Link href={`/post/${post.id}/pick`}>Finish picking →</Link>
        </p>
      )}

      <article className={styles.detail}>
        <MemeCard imageUrl={post.image_url} caption={caption?.text ?? null} mood={caption?.remix?.mood} size="lg" priority />

        <div className={styles.detailBody}>
          <p className={styles.kicker}>
            📸 {isOwner ? "Your upload" : `by ${post.author_name ?? "a member"}`}
          </p>
          <h1 className={styles.detailTitle}>Vote record</h1>
          <BattleRecordCard wins={post.battle_wins} losses={post.battle_losses} />
          <p className={styles.chips}>
            {post.theme && <span className={styles.chip}>{post.theme}</span>}
            {voice && (
              <span className={styles.chip}>
                {voice.emoji} {voice.label}
              </span>
            )}
          </p>

          {isOwner ? (
            <>
              <RemixPanel postId={post.id} />
              <div className={styles.detailActions}>
                <ShareButton />
                <form action={deletePost.bind(null, post.id)}>
                  <button type="submit" className="btn btn-danger">
                    Delete post
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className={styles.detailActions}>
              <Link href="/vote" className="btn btn-primary">
                🗳️ Vote on more uploads
              </Link>
              <ShareButton />
            </div>
          )}
        </div>
      </article>
    </main>
  );
}
