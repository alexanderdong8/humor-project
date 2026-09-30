import type { Metadata } from "next";
import { displayName, requireUser } from "@/lib/auth";
import { getJokeCategories } from "@/lib/jokes";
import { ProfileForm } from "@/components/profile-form";
import styles from "@/components/account.module.css";
import { AvatarUploader } from "./avatar-uploader";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, profile } = await requireUser();
  const categories = await getJokeCategories();

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>Your account</p>
        <h1 className={styles.title}>Profile</h1>
        <p className={styles.lede}>
          Signed in as <strong>{user.email}</strong> with Google.
        </p>

        <h2 className={styles.sectionTitle}>Photo</h2>
        <AvatarUploader userId={user.id} name={displayName(profile, user)} avatarUrl={profile?.avatar_url ?? null} />

        <h2 className={styles.sectionTitle}>Details</h2>
        <ProfileForm
          mode="profile"
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
