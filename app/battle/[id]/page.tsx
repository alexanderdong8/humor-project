import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMyVotes, getPost, getPreview } from "@/lib/battle";
import { deletePost } from "../actions";
import { CaptionList, PostMeta } from "../post-card";
import { LockedCaptions } from "../preview";
import { ShareButton } from "../share-button";
import styles from "../battle.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The public preview works for everyone, including link unfurlers that never sign in. */
async function loadPreview(id: string) {
  if (!UUID.test(id)) return null;
  const [preview] = await getPreview({ post: id, limit: 1 });
  return preview ?? null;
}

export async function generateMetadata(props: PageProps<"/battle/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const preview = await loadPreview(id);
  if (!preview) return { title: "Post not found" };

  const title = preview.top_caption ? `“${preview.top_caption}”` : "Caption Battle";
  return {
    title,
    description: "Vote for the funniest AI caption on Punchline's Caption Battle.",
    openGraph: { title, images: [{ url: preview.image_url }] },
    twitter: { card: "summary_large_image", title, images: [preview.image_url] },
  };
}

export default async function PostPage(props: PageProps<"/battle/[id]">) {
  const [{ id }, searchParams, { user }] = await Promise.all([props.params, props.searchParams, getSession()]);

  if (!user) {
    const preview = await loadPreview(id);
    if (!preview) notFound();
    return <SignedOutPost preview={preview} />;
  }

  const post = UUID.test(id) ? await getPost(id) : null;
  if (!post) notFound();

  const myVotes = await getMyVotes(post.captions.map((c) => c.id));
  const isOwner = user.id === post.user_id;

  return (
    <main id="main" className={styles.main}>
      <Link href="/battle" className={styles.back}>
        ← Back to the battle
      </Link>

      {searchParams.new === "1" && isOwner && (
        <p className={styles.notice} role="status">
          Your captions are live. Send the link to the group chat and let the votes roll in.
        </p>
      )}

      <article className={styles.detail}>
        <div className={styles.detailPhoto}>
          <Image src={post.image_url} alt="" fill sizes="(max-width: 860px) 100vw, 560px" priority />
        </div>

        <div className={styles.detailBody}>
          <PostMeta post={post} />
          <h1 className={styles.detailTitle}>Which caption wins?</h1>
          <CaptionList post={post} myVotes={myVotes} />

          <div className={styles.detailActions}>
            <ShareButton />
            {isOwner && (
              <form action={deletePost.bind(null, post.id)}>
                <button type="submit" className={styles.danger}>
                  Delete post
                </button>
              </form>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}

function SignedOutPost({ preview }: { preview: NonNullable<Awaited<ReturnType<typeof loadPreview>>> }) {
  return (
    <main id="main" className={styles.main}>
      <Link href="/battle" className={styles.back}>
        ← Back to the battle
      </Link>

      <article className={styles.detail}>
        <div className={styles.detailPhoto}>
          <Image src={preview.image_url} alt="" fill sizes="(max-width: 860px) 100vw, 560px" priority />
        </div>

        <div className={styles.detailBody}>
          <div className={styles.meta}>
            <span className={styles.author}>{preview.author_name ?? "A member"}</span>
            {preview.theme && (
              <span className={styles.chips}>
                <span className={styles.chip}>{preview.theme}</span>
              </span>
            )}
          </div>
          <h1 className={styles.detailTitle}>Which caption wins?</h1>
          {preview.top_caption && (
            <div className={styles.caption} data-winner={preview.top_score > 0 || undefined}>
              <div className={styles.captionText}>
                {preview.top_score > 0 && <span className={styles.crown}>Crowd favorite</span>}
                <p>{preview.top_caption}</p>
              </div>
            </div>
          )}
          <LockedCaptions count={Math.max(1, preview.caption_count - 1)} />

          <div className={styles.detailActions}>
            <Link href="/login" className={styles.primary}>
              Sign in to see all captions and vote
            </Link>
            <ShareButton />
          </div>
        </div>
      </article>
    </main>
  );
}
