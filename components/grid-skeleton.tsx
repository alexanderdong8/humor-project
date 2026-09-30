import styles from "./status.module.css";

/** Placeholder for pages that show a heading and a grid of joke cards. */
export function GridSkeleton() {
  return (
    <main id="main" className={styles.skeletonPage} aria-busy="true" aria-label="Loading">
      <div className={styles.bar} style={{ width: 120 }} />
      <div className={styles.bar} style={{ width: "min(420px, 80%)", height: "3rem", marginTop: "1rem" }} />
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={styles.block} />
        ))}
      </div>
    </main>
  );
}
