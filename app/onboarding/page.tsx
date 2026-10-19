import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isProfileComplete, requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/profile-form";
import { Mascot } from "@/components/mascot";
import styles from "@/components/account.module.css";

export const metadata: Metadata = {
  title: "Finish your profile",
  robots: { index: false },
};

export default async function OnboardingPage() {
  const { user, profile } = await requireUser();
  if (isProfileComplete(profile)) redirect("/");

  return (
    <main id="main" className={styles.page}>
      <section className={`${styles.panel} ${styles.narrow} ${styles.card}`}>
        <Mascot mood="wow" size={72} className={styles.mascot} />
        <p className={styles.kicker}>👋 One quick thing</p>
        <h1 className={styles.title}>
          What should we <em>call you?</em>
        </h1>
        <p className={styles.lede}>
          You&apos;re signed in as <strong>{user.email}</strong>. Add your name and you&apos;re in.
        </p>
        <ProfileForm
          mode="onboarding"
          defaults={{
            firstName: profile?.first_name ?? "",
            lastName: profile?.last_name ?? "",
          }}
        />
      </section>
    </main>
  );
}
