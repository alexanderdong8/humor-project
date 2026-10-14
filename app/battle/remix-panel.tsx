"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MOODS, type MoodId } from "@/lib/moods";
import { remixPost } from "./actions";
import styles from "./battle.module.css";

type Props = { postId: string; remixesLeft: number };

const MOOD_HINTS: Record<MoodId, string> = {
  meaner: "Roast it harder",
  funnier: "Go for the big laugh",
  relatable: "“This is literally me”",
};

/** Under a post: ask the AI for more captions in a mood, then they join the battle. */
export function RemixPanel({ postId, remixesLeft }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<MoodId | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [left, setLeft] = useState(remixesLeft);

  function remix(mood: MoodId) {
    setActive(mood);
    setMessage(null);
    startTransition(async () => {
      const result = await remixPost(postId, mood);
      if (result.ok) {
        setLeft((n) => n - 1);
        setMessage({
          kind: "success",
          text: `${MOODS[mood].emoji} Added ${result.added} ${MOODS[mood].label.toLowerCase()} captions. Vote on them below!`,
        });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error });
      }
      setActive(null);
    });
  }

  return (
    <section className={styles.remix} aria-labelledby="remix-title">
      <div className={styles.remixHead}>
        <h2 id="remix-title" className={styles.remixTitle}>
          🔀 Remix
        </h2>
        <p>Not feeling these? Get 3 more captions in a new mood. They join the battle.</p>
      </div>
      <div className={styles.moods}>
        {(Object.keys(MOODS) as MoodId[]).map((mood) => (
          <button
            key={mood}
            type="button"
            className={styles.moodButton}
            data-mood={mood}
            onClick={() => remix(mood)}
            disabled={pending || left <= 0}
            aria-busy={active === mood}
          >
            <span className={styles.moodEmoji} aria-hidden="true">
              {MOODS[mood].emoji}
            </span>
            <span className={styles.moodLabel}>{active === mood ? "Remixing…" : MOODS[mood].label}</span>
            <span className={styles.moodHint}>{MOOD_HINTS[mood]}</span>
          </button>
        ))}
      </div>
      <p className={styles.remixFoot}>
        {left > 0 ? `${left} ${left === 1 ? "remix" : "remixes"} left on this post` : "This post is all remixed out."}
      </p>
      {message && (
        <p className={message.kind === "error" ? styles.error : styles.notice} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
