"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { castVote } from "./actions";
import styles from "./battle.module.css";

type Props = {
  captionId: string;
  upvotes: number;
  downvotes: number;
  myVote: 1 | -1 | 0;
  signedIn: boolean;
};

function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={down ? { rotate: "180deg" } : undefined}>
      <path d="M12 5 4.5 14h5v5h5v-5h5L12 5Z" fill="currentColor" />
    </svg>
  );
}

/** Up/down voting with an instant (optimistic) update that settles on the server's tally. */
export function VoteButtons({ captionId, upvotes, downvotes, myVote, signedIn }: Props) {
  const [state, setState] = useState({ upvotes, downvotes, myVote });
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const score = state.upvotes - state.downvotes;

  if (!signedIn) {
    return (
      <div className={styles.votes}>
        <Link href="/login" className={styles.voteButton} aria-label="Sign in to upvote" title="Sign in to vote">
          <Arrow />
        </Link>
        <span className={styles.score} aria-label={`Score ${score}`}>
          {score}
        </span>
        <Link href="/login" className={styles.voteButton} aria-label="Sign in to downvote" title="Sign in to vote">
          <Arrow down />
        </Link>
      </div>
    );
  }

  function vote(value: 1 | -1) {
    const previous = state;
    // Predict the result so the tap feels instant.
    const next = { ...previous };
    if (previous.myVote === 1) next.upvotes--;
    if (previous.myVote === -1) next.downvotes--;
    next.myVote = previous.myVote === value ? 0 : value;
    if (next.myVote === 1) next.upvotes++;
    if (next.myVote === -1) next.downvotes++;
    setState(next);
    setError(false);

    startTransition(async () => {
      const result = await castVote(captionId, value);
      if (result.ok) {
        setState({ upvotes: result.upvotes, downvotes: result.downvotes, myVote: result.myVote });
      } else {
        setState(previous);
        setError(true);
      }
    });
  }

  return (
    <div className={styles.votes} data-pending={pending || undefined}>
      <button
        type="button"
        className={styles.voteButton}
        data-active={state.myVote === 1 || undefined}
        aria-pressed={state.myVote === 1}
        aria-label="Upvote"
        onClick={() => vote(1)}
      >
        <Arrow />
      </button>
      <span className={styles.score} aria-live="polite" aria-label={`Score ${score}`}>
        {score}
      </span>
      <button
        type="button"
        className={styles.voteButton}
        data-active={state.myVote === -1 || undefined}
        data-down
        aria-pressed={state.myVote === -1}
        aria-label="Downvote"
        onClick={() => vote(-1)}
      >
        <Arrow down />
      </button>
      {error && (
        <span className={styles.voteError} role="alert">
          Vote didn&apos;t save
        </span>
      )}
    </div>
  );
}
