import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mascot } from "@/components/mascot";
import { getSession, isProfileComplete } from "@/lib/auth";
import { DAILY_POST_LIMIT, VOICES } from "@/lib/battle";
import { getDailyTheme } from "@/lib/daily-theme";
import { createClient } from "@/lib/supabase/server";
import { NewPostForm } from "./new-post-form";
import styles from "@/components/game.module.css";

export const metadata: Metadata = {
  title: "Upload",
  description:
    "Upload a photo, let AI write four captions, and battle them head-to-head. The winning caption goes on your photo.",
};

/** How uploading works, shown to everyone; the form itself is for signed-in members. */
function HowItWorks() {
  return (
    <ol className={styles.uploadSteps} aria-label="How uploading works">
      <li>
        <span className={styles.howEmoji}>📸</span>
        <strong>Upload a photo</strong>
        <span>Anything that made you laugh. Pick a caption style, like Sarcastic or Wholesome.</span>
      </li>
      <li>
        <span className={styles.howEmoji}>🤖</span>
        <strong>AI writes 4 captions</strong>
        <span>Four different jokes about your photo, in the style you picked, in a few seconds.</span>
      </li>
      <li>
        <span className={styles.howEmoji}>⚔️</span>
        <strong>Battle the captions</strong>
        <span>They face off two at a time and you tap the funnier one, all the way to a final.</span>
      </li>
      <li>
        <span className={styles.howEmoji}>🏆</span>
        <strong>The winner is kept</strong>
        <span>
          Only the winning caption stays on your photo; the rest are deleted. Your post goes live for others to vote on,
          and you can remix the caption anytime.
        </span>
      </li>
    </ol>
  );
}

export default async function UploadPage() {
  const [{ user, profile }, daily] = await Promise.all([getSession(), getDailyTheme()]);
  if (user && !isProfileComplete(profile)) redirect("/onboarding");

  const header = (
    <header className={styles.centerHeader}>
      <p className={styles.kicker}>📸 Upload</p>
      <h1 className={styles.title}>
        Upload a photo. Keep the <em>funniest</em> caption.
      </h1>
      <p className={styles.lede}>
        Here&apos;s how it works: you upload a photo, AI writes four captions for it, and the captions battle it out
        head-to-head while you pick the funnier one each round. The last caption standing is the one that goes on your
        photo.
      </p>
    </header>
  );

  if (!user) {
    return (
      <main id="main" className={styles.main}>
        {header}
        <HowItWorks />
        <div className={styles.uploadCta}>
          <Link href="/login" className="btn btn-primary">
            Sign in to upload
          </Link>
          <Link href="/vote" className="btn btn-secondary">
            🗳️ Vote on uploads
          </Link>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: usedToday } = await supabase.rpc("my_generations_today");
  const remaining = Math.max(0, DAILY_POST_LIMIT - (usedToday ?? 0));
  const voices = Object.entries(VOICES).map(([id, v]) => ({
    id,
    label: v.label,
    emoji: v.emoji,
    blurb: v.blurb,
    example: v.example,
  }));

  return (
    <main id="main" className={styles.main}>
      {header}
      <HowItWorks />
      <section className={styles.composer} aria-label="Upload a photo">
        {remaining === 0 ? (
          <div className={styles.empty}>
            <Mascot mood="sleepy" size={72} />
            <p className={styles.emptyTitle}>That&apos;s a wrap for today.</p>
            <p>
              You&apos;ve uploaded {DAILY_POST_LIMIT} photos today. Go vote on everyone else&apos;s, then come back
              tomorrow.
            </p>
            <Link href="/vote" className="btn btn-secondary">
              🗳️ Vote on uploads
            </Link>
          </div>
        ) : (
          <NewPostForm userId={user.id} theme={daily.theme} voices={voices} remaining={remaining} />
        )}
      </section>
    </main>
  );
}
