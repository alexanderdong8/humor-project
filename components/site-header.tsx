import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { displayName, getSession, isProfileComplete } from "@/lib/auth";
import { Avatar } from "./avatar";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { ProfilePrompt } from "./profile-prompt";
import styles from "./site-header.module.css";

export async function SiteHeader() {
  const { user, profile } = await getSession();

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.left}>
          <Link href="/" aria-label="Punchline home">
            <Logo collapse />
          </Link>
          <NavLinks signedIn={Boolean(user)} />
        </div>

        {user ? (
          <div className={styles.account}>
            <Link href="/profile" className={styles.profileLink} title="Your profile">
              <Avatar url={profile?.avatar_url ?? null} name={displayName(profile, user)} size={30} />
              <span className={styles.name}>{profile?.first_name || "Profile"}</span>
            </Link>
            <form action={signOut}>
              <button type="submit" className={styles.ghost}>
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link href="/login" className={styles.cta}>
            Sign in
          </Link>
        )}
      </header>

      {user && !isProfileComplete(profile) && <ProfilePrompt />}
    </div>
  );
}
