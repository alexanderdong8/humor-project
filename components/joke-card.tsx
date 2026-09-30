import type { CSSProperties } from "react";
import type { Joke } from "@/lib/jokes";
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
          <span>No. {String(joke.id).padStart(3, "0")}</span>
          {joke.category && <span className={styles.tag}>{joke.category}</span>}
        </span>
        <span className={styles.setup}>{joke.setup}</span>
        <span className={styles.hint} aria-hidden="true">
          <span className={styles.hintClosed}>Tap for the punchline</span>
          <span className={styles.hintOpen}>Ba-dum-tss</span>
        </span>
      </summary>
      <p className={styles.punchline}>{joke.punchline}</p>
    </details>
  );
}
