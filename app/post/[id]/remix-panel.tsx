"use client";

import { useState, useTransition } from "react";
import { MOODS, type MoodId } from "@/lib/moods";
import { remixPost } from "../actions";
import styles from "@/components/game.module.css";

const MOOD_HINTS: Record<MoodId, string> = {
  meaner: "Roast it harder",
  funnier: "Go for the big laugh",
  relatable: "“This is literally me”",
};

/**
 * Owner only: the AI writes 3 new captions in a mood, then the owner battles
 * them against the current caption. The winner stays; the rest are deleted.
 */
export function RemixPanel({ postId }: { postId: string }) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<MoodId | null>(null);
  const [error, setError] = useState<string | null>(null);

  function remix(mood: MoodId) {
    setActive(mood);
    setError(null);
    startTransition(async () => {
      // On success this redirects to the remix battle.
      const result = await remixPost(postId, mood);
      if (result?.error) {
        setError(result.error);
        setActive(null);
      }
    });
  }

  return (
    <section className={styles.remix} aria-labelledby="remix-title">
      <h2 id="remix-title" className={styles.remixTitle}>
        🔀 Remix your caption
      </h2>
      <p className={styles.remixLede}>
        Get 3 new captions in a mood, then battle them against your current one. The winner stays on your
        photo and the rest are deleted, so it never gets cluttered.
      </p>
      <div className={styles.moods}>
        {(Object.keys(MOODS) as MoodId[]).map((mood) => (
          <button
            key={mood}
            type="button"
            className={styles.moodButton}
            data-mood={mood}
            onClick={() => remix(mood)}
            disabled={pending}
            aria-busy={active === mood}
          >
            <span className={styles.moodEmoji} aria-hidden="true">
              {MOODS[mood].emoji}
            </span>
            <span className={styles.moodLabel}>{active === mood ? "Writing…" : MOODS[mood].label}</span>
            <span className={styles.moodHint}>{MOOD_HINTS[mood]}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
