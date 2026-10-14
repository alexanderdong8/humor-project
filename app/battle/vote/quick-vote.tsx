"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import type { Duel, DuelSide } from "@/lib/duels";
import { MOODS } from "@/lib/moods";
import { judgeDuel, skipDuel } from "../actions";
import styles from "../battle.module.css";

type Stats = Record<string, { wins: number; losses: number }>;

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * One matchup at a time: tap a caption (or press ← / →), see how it's doing
 * head-to-head, then the next pair slides in. Skip with ↓ or S.
 */
export function QuickVote({ initial, judgedToday }: { initial: Duel | null; judgedToday: number }) {
  const [duel, setDuel] = useState(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [next, setNext] = useState<Duel | null | undefined>(undefined);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [count, setCount] = useState(judgedToday);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const advance = useCallback(() => {
    if (next === undefined) return;
    setDuel(next);
    setPicked(null);
    setStats(null);
    setNext(undefined);
  }, [next]);

  // After the result shows, move on by itself.
  useEffect(() => {
    if (!picked || next === undefined) return;
    const timer = setTimeout(advance, 1700);
    return () => clearTimeout(timer);
  }, [picked, next, advance]);

  const choose = useCallback(
    (winner: DuelSide, loser: DuelSide) => {
      if (!duel || picked || pending) return;
      setPicked(winner.id);
      setError(false);
      startTransition(async () => {
        const result = await judgeDuel({ postId: duel.post.id, winner: winner.id, loser: loser.id }, skipped);
        if (!result.ok) {
          setPicked(null);
          setError(true);
          return;
        }
        setStats(result.stats);
        setNext(result.next);
        setCount((n) => n + 1);
        setStreak((n) => n + 1);
      });
    },
    [duel, picked, pending, skipped],
  );

  const skip = useCallback(() => {
    if (!duel || picked || pending) return;
    const key = pairKey(duel.left.id, duel.right.id);
    const all = [...skipped, key];
    setSkipped(all);
    startTransition(async () => {
      setDuel(await skipDuel(all));
    });
  }, [duel, picked, pending, skipped]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!duel || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft") choose(duel.left, duel.right);
      else if (event.key === "ArrowRight") choose(duel.right, duel.left);
      else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") skip();
      else if (event.key === "Enter" && picked) advance();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duel, choose, skip, advance, picked]);

  if (!duel) {
    return (
      <div className={styles.empty}>
        <Mascot mood="sleepy" size={84} />
        <p className={styles.emptyTitle}>You&apos;ve judged every matchup! 🎉</p>
        <p>
          {count > 0 ? `${count} picks today. ` : ""}New matchups show up when people post photos or remix captions.
        </p>
        <div className={styles.detailActions}>
          <Link href="/battle/new" className="btn btn-primary">
            📸 Post a photo
          </Link>
          <Link href="/battle" className="btn btn-secondary">
            🔀 Remix a post
          </Link>
        </div>
      </div>
    );
  }

  const sides: [DuelSide, DuelSide, "←" | "→"][] = [
    [duel.left, duel.right, "←"],
    [duel.right, duel.left, "→"],
  ];

  return (
    <section className={styles.quick} aria-live="polite">
      <div className={styles.quickStatus}>
        <span>
          🔥 <strong>{count}</strong> {count === 1 ? "pick" : "picks"} today
        </span>
        {streak >= 3 && <span className={styles.streak}>{streak} in a row!</span>}
        <span className={styles.quickRemaining}>{duel.remaining} matchups left</span>
      </div>

      <div className={styles.quickPhoto} key={duel.post.id}>
        {duel.post.kind === "daily" && <span className={styles.aiBadge}>🤖 Today&apos;s AI photo</span>}
        <Image src={duel.post.image_url} alt="" fill sizes="(max-width: 860px) 100vw, 760px" priority />
      </div>
      {duel.post.photo_credit && (
        <p className={styles.credit}>
          📷 {duel.post.photo_credit} · via Openverse
        </p>
      )}

      <div className={styles.matchup} key={pairKey(duel.left.id, duel.right.id)}>
        {sides.map(([side, other, arrow], i) => {
          const s = stats?.[side.id];
          const total = s ? s.wins + s.losses : 0;
          const rate = s && total > 0 ? Math.round((s.wins / total) * 100) : null;
          const state = !picked ? undefined : picked === side.id ? "won" : "lost";
          const mood = side.mood ? MOODS[side.mood] : null;
          return (
            <button
              key={side.id}
              type="button"
              className={styles.contender}
              data-state={state}
              data-side={i === 0 ? "left" : "right"}
              onClick={() => choose(side, other)}
              disabled={Boolean(picked) || pending}
              aria-label={`Pick this caption: ${side.text}`}
            >
              <span className={styles.contenderKey} aria-hidden="true">
                {arrow}
              </span>
              {mood && (
                <span className={styles.moodTag}>
                  {mood.emoji} {mood.label} remix
                </span>
              )}
              <span className={styles.contenderText}>{side.text}</span>
              {state === "won" && <span className={styles.contenderBurst}>😂 Your pick!</span>}
              {rate !== null && (
                <span className={styles.rate}>
                  <span className={styles.rateBar}>
                    <span style={{ width: `${rate}%` }} />
                  </span>
                  Wins {rate}% of {total} {total === 1 ? "matchup" : "matchups"}
                </span>
              )}
            </button>
          );
        })}
        <span className={styles.vs} aria-hidden="true">
          VS
        </span>
      </div>

      <div className={styles.quickActions}>
        {picked ? (
          <button type="button" className="btn btn-primary" onClick={advance} disabled={next === undefined}>
            {next === undefined ? "Counting votes…" : "Next matchup →"}
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={skip} disabled={pending}>
            {pending ? "Loading…" : "Skip ↓"}
          </button>
        )}
        <Link href={`/battle/${duel.post.id}`} className={styles.textLink}>
          See the whole post
        </Link>
      </div>
      <p className={styles.keys}>Tip: ← and → pick, ↓ skips.</p>
      {error && (
        <p className={styles.error} role="alert">
          That pick didn&apos;t save. Try again.
        </p>
      )}
    </section>
  );
}
