"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "@/components/status.module.css";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className={styles.wrap}>
      <div>
        <p className={styles.code}>Something went wrong</p>
        <h1 className={styles.title}>
          The mic <em>cut out.</em>
        </h1>
        <p className={styles.body}>
          That&apos;s on us, not you. Give it another try, and if it keeps happening, check back in a
          few minutes.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => retry()}>
            Try again
          </button>
          <Link href="/" className={styles.secondary}>
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
