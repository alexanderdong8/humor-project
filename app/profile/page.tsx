import type { Metadata } from "next";
import { displayName, requireUser } from "@/lib/auth";
import { getJokeCategories } from "@/lib/jokes";
import { ProfileForm } from "@/components/profile-form";
import styles from "@/components/account.module.css";
import { AvatarUploader } from "./avatar-uploader";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false },
};

export default async function ProfilePage() {
  const { user, profile } = await requireUser();
  const categories = await getJokeCategories();

  return (
    <main id="main" className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.kicker}>Account</p>
        <h1 className={styles.title}>Your profile</h1>
        <p className={styles.lede}>
          Signed in with Google as <strong>{user.email}</strong>.
        </p>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            <h2>Photo</h2>
            <p>Shown in the header and the Green Room.</p>
          </div>
          <AvatarUploader
            userId={user.id}
            name={displayName(profile, user)}
            avatarUrl={profile?.avatar_url ?? null}
          />
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            <h2>Details</h2>
            <p>Your name and the kind of jokes you like best.</p>
          </div>
          <ProfileForm
            mode="profile"
            categories={categories}
            defaults={{
              firstName: profile?.first_name ?? "",
              lastName: profile?.last_name ?? "",
              favoriteCategory: profile?.favorite_category ?? "",
            }}
          />
        </div>
      </section>
    </main>
  );
}
