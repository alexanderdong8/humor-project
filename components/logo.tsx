import { site } from "@/lib/site";
import { Mascot } from "./mascot";
import styles from "./logo.module.css";

type Props = { collapse?: boolean };

/** Mic the mascot plus the wordmark. `collapse` hides the word on narrow screens. */
export function Logo({ collapse = false }: Props) {
  return (
    <span className={styles.logo}>
      <Mascot size={30} className={styles.mark} />
      <span className={`${styles.word} ${collapse ? styles.collapse : ""}`}>{site.name}</span>
    </span>
  );
}
