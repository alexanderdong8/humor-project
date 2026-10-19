import type { Metadata } from "next";
import { displayName, requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/profile-form";
import styles from "@/components/account.module.css";
import { AvatarUploader } from "./avatar-uploader";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false },
};

export default async function ProfilePage() {
  const { user, profile } = await requireUser();

  return (
    <main id="main" className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.kicker}>🙂 Your account</p>
        <h1 className={styles.title}>Your profile</h1>
        <p className={styles.lede}>
          Signed in with Google as <strong>{user.email}</strong>.
        </p>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            <h2>Photo</h2>
            <p>Shown in the header and on your home page.</p>
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
            <p>Your name, shown as the author of your uploads.</p>
          </div>
          <ProfileForm
            mode="profile"
            defaults={{
              firstName: profile?.first_name ?? "",
              lastName: profile?.last_name ?? "",
            }}
          />
        </div>
      </section>
    </main>
  );
}
