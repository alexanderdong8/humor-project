import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPost } from "@/lib/battle";
import { CaptionBracket } from "./bracket";
import styles from "@/components/game.module.css";

export const metadata: Metadata = {
  title: "Pick your caption",
  robots: { index: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only the uploader runs the bracket over their photo's candidate captions. */
export default async function PickPage(props: PageProps<"/post/[id]/pick">) {
  const { id } = await props.params;
  const { user } = await requireUser();
  const post = UUID.test(id) ? await getPost(id) : null;
  if (!post || post.user_id !== user.id) notFound();

  // Nothing to choose between (e.g. a remix already finished): back to the post.
  if (post.captions.length < 2) redirect(`/post/${post.id}`);

  const mode = post.status === "draft" ? "new" : "remix";
  // Shuffle so the AI's ordering doesn't decide who meets whom.
  const candidates = [...post.captions]
    .sort(() => Math.random() - 0.5)
    .map((c) => ({
      id: c.id,
      text: c.text,
      mood: c.remix?.mood ?? null,
      tag: mode === "remix" && c.id === post.caption_id ? "Current caption" : undefined,
    }));

  return (
    <main id="main" className={styles.main}>
      {mode === "remix" && (
        <Link href={`/post/${post.id}`} className={styles.back}>
          ← Keep my current caption
        </Link>
      )}
      <header className={styles.centerHeader}>
        <p className={styles.kicker}>{mode === "new" ? "📸 Step 2 of 2" : "🔀 Remix battle"}</p>
        <h1 className={styles.title}>
          Pick your <em>caption.</em>
        </h1>
        <p className={styles.lede}>
          {mode === "new"
            ? "The AI wrote 4 captions. Knock them out two at a time; the winner is the only caption people will see on your photo, and it goes straight into the battle."
            : "Your current caption takes on the new ones. Whatever wins stays on your photo; the rest are deleted."}
        </p>
      </header>
      <CaptionBracket postId={post.id} imageUrl={post.image_url} candidates={candidates} mode={mode} />
    </main>
  );
}
