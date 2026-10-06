import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMyVotes, getPost } from "@/lib/battle";
import { deletePost } from "../actions";
import { CaptionList, PostMeta } from "../post-card";
import { ShareButton } from "../share-button";
import styles from "../battle.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  return UUID.test(id) ? getPost(id) : null;
}

export async function generateMetadata(props: PageProps<"/battle/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const post = await load(id);
  if (!post) return { title: "Post not found" };

  const best = [...post.captions].sort((a, b) => b.score - a.score)[0];
  const title = best ? `“${best.text}”` : "Caption Battle";
  return {
    title,
    description: "Vote for the funniest AI caption on Punchline's Caption Battle.",
    openGraph: { title, images: [{ url: post.image_url }] },
    twitter: { card: "summary_large_image", title, images: [post.image_url] },
  };
}

export default async function PostPage(props: PageProps<"/battle/[id]">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const post = await load(id);
  if (!post) notFound();

  const { user } = await getSession();
  const myVotes = user ? await getMyVotes(post.captions.map((c) => c.id)) : new Map();
  const isOwner = user?.id === post.user_id;

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
          <CaptionList post={post} myVotes={myVotes} signedIn={Boolean(user)} />
          {!user && (
            <p className={styles.hint}>
              <Link href="/login">Sign in</Link> to vote. It takes one click with Google.
            </p>
          )}

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
