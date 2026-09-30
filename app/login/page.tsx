import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isProfileComplete } from "@/lib/auth";
import styles from "@/components/account.module.css";
import { GoogleButton } from "./google-button";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in with Google to enter the Green Room.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { user, profile } = await getSession();
  if (user) redirect(isProfileComplete(profile) ? "/members" : "/onboarding");

  const { error } = await props.searchParams;

  return (
    <main id="main" className={styles.page}>
      <section className={`${styles.panel} ${styles.narrow} ${styles.card} ${styles.centered}`}>
        <p className={styles.kicker}>Members only</p>
        <h1 className={styles.title}>
          Welcome to the <em>Green Room.</em>
        </h1>
        <p className={styles.lede}>
          Sign in to get a set of jokes picked for you and a profile of your own.
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
