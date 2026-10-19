"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { matchKey, type Contender, type Matchup } from "@/lib/arena-shared";
import { MOODS } from "@/lib/moods";
import { judgeMatchup, skipMatchup, type BattleRecord } from "./actions";
import styles from "@/components/game.module.css";

/**
 * Post vs. post: tap the funnier photo + caption (or press ← / →). After a
 * pick both posts' records show for a moment, then the next pair loads.
 */
export function Arena({ initial, judgedToday }: { initial: Matchup | null; judgedToday: number }) {
  const [matchup, setMatchup] = useState(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [records, setRecords] = useState<{ [id: string]: BattleRecord } | null>(null);
  const [next, setNext] = useState<Matchup | null | undefined>(undefined);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [count, setCount] = useState(judgedToday);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const advance = useCallback(() => {
    if (next === undefined) return;
    setMatchup(next);
    setPicked(null);
    setRecords(null);
    setNext(undefined);
  }, [next]);

  useEffect(() => {
    if (!picked || next === undefined) return;
    const timer = setTimeout(advance, 1900);
    return () => clearTimeout(timer);
  }, [picked, next, advance]);

  const choose = useCallback(
    (winner: Contender, loser: Contender) => {
      if (picked || pending) return;
      setPicked(winner.id);
      setError(false);
      startTransition(async () => {
        const result = await judgeMatchup({ winner: winner.id, loser: loser.id }, skipped);
        if (!result.ok) {
          setPicked(null);
          setError(true);
          return;
        }
        setRecords(result.records);
        setNext(result.next);
        setCount((n) => n + 1);
        setStreak((n) => n + 1);
      });
    },
    [picked, pending, skipped],
  );

  const skip = useCallback(() => {
    if (!matchup || picked || pending) return;
    const all = [...skipped, matchKey(matchup.left.id, matchup.right.id)];
    setSkipped(all);
    startTransition(async () => {
      setMatchup(await skipMatchup(all));
    });
  }, [matchup, picked, pending, skipped]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!matchup || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft") choose(matchup.left, matchup.right);
      else if (event.key === "ArrowRight") choose(matchup.right, matchup.left);
      else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") skip();
      else if (event.key === "Enter" && picked) advance();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [matchup, choose, skip, advance, picked]);

  if (!matchup) {
    return (
      <div className={styles.empty}>
        <Mascot mood="sleepy" size={84} />
        <p className={styles.emptyTitle}>You&apos;ve judged every matchup! 🎉</p>
        <p>
          {count > 0 ? `${count} picks today. ` : ""}New battles show up as people post. Post your own, or vote on
          today&apos;s AI meme.
        </p>
        <div className={styles.detailActions}>
          <Link href="/post/new" className="btn btn-primary">
            📸 Post a photo
          </Link>
          <Link href="/daily" className="btn btn-secondary">
            🤖 Today&apos;s AI meme
          </Link>
        </div>
      </div>
    );
  }

  const sides: [Contender, Contender, "←" | "→"][] = [
    [matchup.left, matchup.right, "←"],
    [matchup.right, matchup.left, "→"],
  ];

  return (
    <section className={styles.arena} aria-live="polite">
      <div className={styles.arenaStatus}>
        <span>
          🔥 <strong>{count}</strong> {count === 1 ? "pick" : "picks"} today
        </span>
        {streak >= 3 && <span className={styles.streak}>{streak} in a row!</span>}
        <span className={styles.remaining}>{matchup.remaining} matchups left</span>
      </div>

      <div className={styles.battleGrid} key={matchKey(matchup.left.id, matchup.right.id)}>
        {sides.map(([post, other, arrow], i) => {
          const record = records?.[post.id];
          const total = record ? record.wins + record.losses : 0;
          const rate = record && total > 0 ? Math.round((record.wins / total) * 100) : null;
          const state = !picked ? undefined : picked === post.id ? "won" : "lost";
          const mood = post.mood ? MOODS[post.mood] : null;
          return (
            <button
              key={post.id}
              type="button"
              className={styles.contenderPost}
              data-state={state}
              data-side={i === 0 ? "left" : "right"}
              onClick={() => choose(post, other)}
              disabled={Boolean(picked) || pending}
              aria-label={`Pick this post: ${post.caption}`}
            >
              <span className={styles.postPhoto}>
                <span className={styles.postKey} aria-hidden="true">
                  {arrow}
                </span>
                <Image src={post.image_url} alt="" fill sizes="(max-width: 760px) 100vw, 520px" priority />
              </span>
              <span className={styles.postCaption}>
                {mood && (
                  <span className={styles.moodTag}>
                    {mood.emoji} {mood.label} remix
                  </span>
                )}
                <span>{post.caption}</span>
              </span>
              <span className={styles.postBy}>by {post.author_name ?? "a member"}</span>
              {state === "won" && <span className={styles.contenderBurst}>😂 Your pick!</span>}
              {rate !== null && record && (
                <span className={styles.rate}>
                  <span className={styles.rateBar}>
                    <span style={{ width: `${rate}%` }} />
                  </span>
                  {record.wins}W · {record.losses}L · wins {rate}%
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
            {next === undefined ? "Counting votes…" : "Next battle →"}
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={skip} disabled={pending}>
            {pending ? "Loading…" : "Skip ↓"}
          </button>
        )}
        <Link href="/top" className={styles.textLink}>
          🏆 See the leaderboard
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
