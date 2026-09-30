"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./site-header.module.css";

/** Nudges signed-in users with a blank name to finish onboarding (hidden on that page itself). */
export function ProfilePrompt() {
  if (usePathname() === "/onboarding") return null;

  return (
    <p className={styles.prompt} role="status">
      <span>Your profile is missing a name.</span>
      <Link href="/onboarding">Finish setting up</Link>
    </p>
  );
}
