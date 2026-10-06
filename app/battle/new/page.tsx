import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isProfileComplete, requireUser } from "@/lib/auth";
import { DAILY_POST_LIMIT, themeForDate, VOICES } from "@/lib/battle";
import { createClient } from "@/lib/supabase/server";
import { NewPostForm } from "./new-post-form";
import styles from "../battle.module.css";

export const metadata: Metadata = {
  title: "Caption a photo",
  robots: { index: false },
};

export default async function NewPostPage() {
  const { user, profile } = await requireUser();
  if (!isProfileComplete(profile)) redirect("/onboarding");

  const supabase = await createClient();
  const { data: usedToday } = await supabase.rpc("my_generations_today");
  const remaining = Math.max(0, DAILY_POST_LIMIT - (usedToday ?? 0));

  const voices = Object.entries(VOICES).map(([id, v]) => ({ id, label: v.label, blurb: v.blurb }));

  return (
    <main id="main" className={styles.main}>
      <Link href="/battle" className={styles.back}>
        ← Back to the battle
      </Link>
      <section className={styles.composer}>
        <p className={styles.kicker}>New post</p>
        <h1 className={styles.composerTitle}>
          Give us a photo. <em>We&apos;ll bring the bit.</em>
        </h1>
        <p className={styles.lede}>
          Our AI writes four captions in the voice you pick. Then everyone votes on the funniest.
        </p>

        {remaining === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>That&apos;s a wrap for today.</p>
            <p>You&apos;ve posted {DAILY_POST_LIMIT} times today. Go vote on everyone else&apos;s, then come back tomorrow.</p>
            <Link href="/battle" className={styles.secondary}>
              Vote on today&apos;s posts
            </Link>
          </div>
        ) : (
          <NewPostForm userId={user.id} theme={themeForDate()} voices={voices} remaining={remaining} />
        )}
      </section>
    </main>
  );
}
