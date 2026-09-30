import { site } from "@/lib/site";
import styles from "./logo.module.css";

type Props = { collapse?: boolean };

/** Microphone mark plus wordmark. `collapse` hides the word on narrow screens. */
export function Logo({ collapse = false }: Props) {
  return (
    <span className={styles.logo}>
      <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="var(--amber)" />
        <rect x="25.5" y="13" width="13" height="23" rx="6.5" fill="var(--ink)" />
        <path d="M20 30a12 12 0 0 0 24 0" fill="none" stroke="var(--ink)" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M32 42v7M25.5 49h13" fill="none" stroke="var(--ink)" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
      <span className={`${styles.word} ${collapse ? styles.collapse : ""}`}>{site.name}</span>
    </span>
  );
}
