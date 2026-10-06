"use client";

import { useState } from "react";
import styles from "./battle.module.css";

/** Native share sheet on phones, copy-to-clipboard everywhere else. */
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href.split("?")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title: "Vote on these captions", url });
        return;
      } catch {
        // Dismissed the share sheet; fall through to copying.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className={styles.secondary} onClick={share}>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
