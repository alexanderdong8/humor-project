import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isProfileComplete } from "@/lib/auth";
import styles from "@/components/account.module.css";
import { GoogleButton } from "./google-button";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { user, profile } = await getSession();
  if (user) redirect(isProfileComplete(profile) ? "/members" : "/onboarding");

  const { error } = await props.searchParams;

  return (
    <main className={styles.page}>
      <section className={`${styles.panel} ${styles.narrow}`}>
        <p className={styles.eyebrow}>Members only</p>
        <h1 className={styles.title}>Get backstage.</h1>
        <p className={styles.lede}>
          Sign in to reach the Green Room, pick a favorite kind of joke, and set up your profile.
        </p>
        <GoogleButton />
        {typeof error === "string" && (
          <p className={styles.error} role="alert">
            Sign-in failed: {error}
          </p>
        )}
      </section>
    </main>
  );
}
