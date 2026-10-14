import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isProfileComplete, requireUser } from "@/lib/auth";
import { getJudgedToday, getNextDuel } from "@/lib/duels";
import { QuickVote } from "./quick-vote";
import styles from "../battle.module.css";

export const metadata: Metadata = {
  title: "Quick Vote",
  description: "Two captions, one photo. Tap the funnier one.",
  robots: { index: false },
};

export default async function QuickVotePage() {
  const { user, profile } = await requireUser();
  if (!isProfileComplete(profile)) redirect("/onboarding");

  const [duel, judgedToday] = await Promise.all([getNextDuel(user.id), getJudgedToday(user.id)]);

  return (
    <main id="main" className={styles.main}>
      <Link href="/battle" className={styles.back}>
        ← Back to the battle
      </Link>
      <header className={styles.quickHeader}>
        <p className={styles.kicker}>⚡ Quick Vote</p>
        <h1 className={styles.quickTitle}>
          Which caption is <em>funnier?</em>
        </h1>
        <p className={styles.lede}>Two captions, same photo. Tap the one that made you laugh. Every pick moves the leaderboard.</p>
      </header>
      <QuickVote initial={duel} judgedToday={judgedToday} />
    </main>
  );
}
