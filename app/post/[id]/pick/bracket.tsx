"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CaptionFaceoff, type FaceoffSide } from "@/components/caption-faceoff";
import { chooseCaption } from "../../actions";
import styles from "@/components/game.module.css";

type Props = {
  postId: string;
  imageUrl: string;
  candidates: FaceoffSide[];
  mode: "new" | "remix";
};

/**
 * A knockout bracket over the candidate captions: each match's winner goes to
 * the back of the line until one caption is left. With 4 captions that's two
 * semifinals and a final. The champion becomes the photo's only caption.
 */
export function CaptionBracket({ postId, imageUrl, candidates, mode }: Props) {
  const [queue, setQueue] = useState(candidates);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  const totalMatches = candidates.length - 1;
  const played = candidates.length - queue.length;
  const champion = queue.length === 1 ? queue[0] : null;
  const isFinal = queue.length === 2;

  const publish = useCallback(
    (winner: FaceoffSide) => {
      setError(null);
      startTransition(async () => {
        // On success this redirects to the post.
        const result = await chooseCaption(postId, winner.id);
        if (result?.error) setError(result.error);
      });
    },
    [postId],
  );

  const pick = useCallback(
    (winner: FaceoffSide, loser: FaceoffSide) => {
      if (picked || saving) return;
      setPicked(winner.id);
      setTimeout(() => {
        const next = [...queue.filter((c) => c.id !== winner.id && c.id !== loser.id), winner];
        setQueue(next);
        setPicked(null);
        if (next.length === 1) publish(winner);
      }, 650);
    },
    [picked, saving, queue, publish],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (queue.length < 2 || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft") pick(queue[0], queue[1]);
      else if (event.key === "ArrowRight") pick(queue[1], queue[0]);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue, pick]);

  if (champion) {
    return (
      <section className={styles.faceoff}>
        <div className={styles.champion}>
          <p className={styles.kicker}>🏆 Your caption</p>
          <p className={styles.championText}>{champion.text}</p>
          <p className={styles.hint}>
            {saving
              ? mode === "new"
                ? "Posting your upload…"
                : "Updating your post…"
              : error ?? "Saved!"}
          </p>
          {error && (
            <button type="button" className="btn btn-primary" onClick={() => publish(champion)}>
              Try again
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.faceoff} aria-live="polite">
      <div className={styles.roundInfo}>
        <span className={styles.roundLabel}>
          {isFinal ? "🏆 Final" : `Match ${played + 1} of ${totalMatches}`}
        </span>
        <span className={styles.roundDots} aria-hidden="true">
          {Array.from({ length: totalMatches }, (_, i) => (
            <span key={i} data-done={i < played || undefined} data-current={i === played || undefined} />
          ))}
        </span>
        <button type="button" className={styles.linkButton} onClick={() => setQueue(candidates)} disabled={played === 0}>
          Start over
        </button>
      </div>
      <CaptionFaceoff imageUrl={imageUrl} left={queue[0]} right={queue[1]} picked={picked} onPick={pick} />
      <p className={styles.keys}>Tip: ← and → pick.</p>
    </section>
  );
}
