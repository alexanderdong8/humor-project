import type { CSSProperties } from "react";
import { categoryEmoji, type Joke } from "@/lib/jokes";
import styles from "./joke-card.module.css";

type Props = { joke: Joke; featured?: boolean; index?: number };

/**
 * Setup up front, punchline behind a tap. Built on <details> so it works
 * without JavaScript and with keyboards and screen readers.
 */
export function JokeCard({ joke, featured = false, index = 0 }: Props) {
  return (
    <details
      className={`${styles.card} ${featured ? styles.featured : ""}`}
      style={{ "--i": index } as CSSProperties}
    >
      <summary className={styles.summary}>
        <span className={styles.meta}>
          {joke.category && (
            <span className={styles.tag}>
              <span aria-hidden="true">{categoryEmoji(joke.category)}</span> {joke.category}
            </span>
          )}
          <span className={styles.number}>#{joke.id}</span>
        </span>
        <span className={styles.setup}>{joke.setup}</span>
        <span className={styles.hint} aria-hidden="true">
          <span className={styles.hintClosed}>Tap for the punchline 👀</span>
          <span className={styles.hintOpen}>Ba-dum-tss! 🥁</span>
        </span>
      </summary>
      <p className={styles.punchline}>{joke.punchline}</p>
    </details>
  );
}
