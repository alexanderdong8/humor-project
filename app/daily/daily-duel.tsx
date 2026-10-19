"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaptionFaceoff, type FaceoffSide } from "@/components/caption-faceoff";
import type { Duel } from "@/lib/duels";
import { judgeDailyDuel, skipDailyDuel } from "./actions";
import styles from "@/components/game.module.css";

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

type Props = { postId: string; imageUrl: string; credit: string | null; initial: Duel | null };

/** The daily meme's caption battle: pick the funnier of two AI captions, see how each is doing, repeat. */
export function DailyDuel({ postId, imageUrl, credit, initial }: Props) {
  const router = useRouter();
  const [duel, setDuel] = useState(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [stats, setStats] = useState<{ [id: string]: { wins: number; losses: number } } | null>(null);
  const [next, setNext] = useState<Duel | null | undefined>(undefined);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const advance = useCallback(() => {
    if (next === undefined) return;
    setDuel(next);
    setPicked(null);
    setStats(null);
    setNext(undefined);
    // Refresh the standings below with the new results.
    router.refresh();
  }, [next, router]);

  useEffect(() => {
    if (!picked || next === undefined) return;
    const timer = setTimeout(advance, 1700);
    return () => clearTimeout(timer);
  }, [picked, next, advance]);

  const choose = useCallback(
    (winner: FaceoffSide, loser: FaceoffSide) => {
      if (picked || pending) return;
      setPicked(winner.id);
      setError(false);
      startTransition(async () => {
        const result = await judgeDailyDuel({ postId, winner: winner.id, loser: loser.id }, skipped);
        if (!result.ok) {
          setPicked(null);
          setError(true);
          return;
        }
        setStats(result.stats);
        setNext(result.next);
      });
    },
    [picked, pending, postId, skipped],
  );

  const skip = useCallback(() => {
    if (!duel || picked || pending) return;
    const all = [...skipped, pairKey(duel.left.id, duel.right.id)];
    setSkipped(all);
    startTransition(async () => {
      setDuel(await skipDailyDuel(postId, all));
    });
  }, [duel, picked, pending, postId, skipped]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!duel || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft") choose(duel.left, duel.right);
      else if (event.key === "ArrowRight") choose(duel.right, duel.left);
      else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") skip();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duel, choose, skip]);

  if (!duel) {
    return (
      <div className={styles.doneCard}>
        <p className={styles.emptyTitle}>You&apos;ve judged every pair today! 🎉</p>
        <p>See how the captions stack up below. A new meme drops at midnight.</p>
        <div className={styles.quickActions}>
          <Link href="/vote" className="btn btn-primary">
            🗳️ Vote on uploads
          </Link>
          <Link href="/upload" className="btn btn-secondary">
            📸 Upload a photo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className={styles.faceoff} aria-live="polite">
      <CaptionFaceoff
        imageUrl={imageUrl}
        badge="🤖 AI meme"
        credit={credit}
        left={duel.left}
        right={duel.right}
        picked={picked}
        disabled={pending}
        stats={stats}
        onPick={choose}
      />
      <div className={styles.quickActions}>
        {picked ? (
          <button type="button" className="btn btn-primary" onClick={advance} disabled={next === undefined}>
            {next === undefined ? "Counting votes…" : "Next pair →"}
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={skip} disabled={pending}>
            {pending ? "Loading…" : "Skip ↓"}
          </button>
        )}
        <span className={styles.remaining}>{duel.remaining} pairs left</span>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          That pick didn&apos;t save. Try again.
        </p>
      )}
    </section>
  );
}
