import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isProfileComplete } from "@/lib/auth";
import { Mascot } from "@/components/mascot";
import styles from "@/components/account.module.css";
import { GoogleButton } from "./google-button";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in with Google to upload photos, battle AI captions, and vote.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { user, profile } = await getSession();
  if (user) redirect(isProfileComplete(profile) ? "/" : "/onboarding");

  const { error } = await props.searchParams;

  return (
    <main id="main" className={styles.page}>
      <section className={`${styles.panel} ${styles.narrow} ${styles.card} ${styles.centered}`}>
        <Mascot mood="happy" size={84} className={styles.mascot} />
        <p className={styles.kicker}>🎤 Members only</p>
        <h1 className={styles.title}>
          Grab the <em>mic.</em>
        </h1>
        <p className={styles.lede}>
          Sign in to upload photos, battle their AI captions, and vote on everyone else&apos;s.
        </p>
        <GoogleButton />
        {typeof error === "string" && (
          <p className={styles.error} role="alert">
            We couldn&apos;t sign you in. Please try again.
          </p>
        )}
        <p className={styles.fine}>
          We only use your Google account to sign you in. Your name and email are never shared.
        </p>
      </section>
    </main>
  );
}
