import Link from "next/link";
import styles from "@/components/status.module.css";

export default function NotFound() {
  return (
    <main id="main" className={styles.wrap}>
      <div>
        <p className={styles.code}>404 · Page not found</p>
        <h1 className={styles.title}>
          This bit <em>didn&apos;t land.</em>
        </h1>
        <p className={styles.body}>
          The page you&apos;re looking for has left the stage, or never booked the gig.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primary}>
            Back to home
          </Link>
          <Link href="/jokes" className={styles.secondary}>
            Browse the library
          </Link>
        </div>
      </div>
    </main>
  );
}
