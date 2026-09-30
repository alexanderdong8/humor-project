import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isProfileComplete, requireUser } from "@/lib/auth";
import { getJokeCategories } from "@/lib/jokes";
import { ProfileForm } from "@/components/profile-form";
import styles from "@/components/account.module.css";

export const metadata: Metadata = {
  title: "Finish your profile",
  robots: { index: false },
};

export default async function OnboardingPage() {
  const { user, profile } = await requireUser();
  if (isProfileComplete(profile)) redirect("/members");

  const categories = await getJokeCategories();

  return (
    <main id="main" className={styles.page}>
      <section className={`${styles.panel} ${styles.narrow} ${styles.card}`}>
        <p className={styles.kicker}>Step 1 of 1</p>
        <h1 className={styles.title}>
          What should we <em>call you?</em>
        </h1>
        <p className={styles.lede}>
          You&apos;re signed in as <strong>{user.email}</strong>. Add your name and we&apos;ll open
          the Green Room.
        </p>
        <ProfileForm
          mode="onboarding"
          categories={categories}
          defaults={{
            firstName: profile?.first_name ?? "",
            lastName: profile?.last_name ?? "",
            favoriteCategory: profile?.favorite_category ?? "",
          }}
        />
      </section>
    </main>
  );
}
