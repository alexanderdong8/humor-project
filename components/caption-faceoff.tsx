"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { MOODS, type MoodId } from "@/lib/moods";
import styles from "./game.module.css";

export type FaceoffSide = { id: string; text: string; mood: MoodId | null; tag?: string };

type Props = {
  imageUrl: string;
  badge?: ReactNode;
  credit?: ReactNode;
  left: FaceoffSide;
  right: FaceoffSide;
  picked: string | null;
  disabled?: boolean;
  /** Head-to-head records to show after a pick, by caption id. */
  stats?: { [id: string]: { wins: number; losses: number } } | null;
  onPick: (winner: FaceoffSide, loser: FaceoffSide) => void;
};

/** One photo, two captions: tap (or press ← / →) the funnier one. */
export function CaptionFaceoff({ imageUrl, badge, credit, left, right, picked, disabled, stats, onPick }: Props) {
  const sides: [FaceoffSide, FaceoffSide, "←" | "→"][] = [
    [left, right, "←"],
    [right, left, "→"],
  ];

  return (
    <>
      <div className={styles.faceoffPhoto}>
        {badge && <span className={styles.aiBadge}>{badge}</span>}
        <Image src={imageUrl} alt="" fill sizes="(max-width: 860px) 100vw, 760px" priority />
      </div>
      {credit && <p className={styles.credit}>{credit}</p>}

      <div className={styles.matchup} key={`${left.id}:${right.id}`}>
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
              onClick={() => onPick(side, other)}
              disabled={Boolean(picked) || disabled}
              aria-label={`Pick this caption: ${side.text}`}
            >
              <span className={styles.contenderKey} aria-hidden="true">
                {arrow}
              </span>
              {(side.tag || mood) && (
                <span className={styles.tags}>
                  {side.tag && <span className={styles.tagCurrent}>{side.tag}</span>}
                  {mood && (
                    <span className={styles.moodTag}>
                      {mood.emoji} {mood.label} remix
                    </span>
                  )}
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
    </>
  );
}
