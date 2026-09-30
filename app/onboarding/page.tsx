import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isProfileComplete, requireUser } from "@/lib/auth";
import { getJokeCategories } from "@/lib/jokes";
import { ProfileForm } from "@/components/profile-form";
import styles from "@/components/account.module.css";

export const metadata: Metadata = { title: "Finish your profile" };

export default async function OnboardingPage() {
  const { user, profile } = await requireUser();
  if (isProfileComplete(profile)) redirect("/members");

  const categories = await getJokeCategories();

  return (
    <main className={styles.page}>
      <section className={`${styles.panel} ${styles.narrow}`}>
        <p className={styles.eyebrow}>One quick thing</p>
        <h1 className={styles.title}>What should we call you?</h1>
        <p className={styles.lede}>
          You&apos;re signed in as <strong>{user.email}</strong>. Add your name to get into the Green Room.
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
