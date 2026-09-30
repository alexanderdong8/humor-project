import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { displayName, getSession, isProfileComplete } from "@/lib/auth";
import { Avatar } from "./avatar";
import { ProfilePrompt } from "./profile-prompt";
import styles from "./site-header.module.css";

export async function SiteHeader() {
  const { user, profile } = await getSession();

  return (
    <>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Main">
          <Link href="/" className={styles.brand}>
            Humor Project
          </Link>
          <Link href="/jokes">Jokes</Link>
          {user ? (
            <Link href="/members">Green Room</Link>
          ) : (
            <Link href="/login" className={styles.locked} title="Sign in to enter">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z"
                />
              </svg>
              Green Room
            </Link>
          )}
        </nav>

        {user ? (
          <div className={styles.account}>
            <Link href="/profile" className={styles.profileLink}>
              <Avatar url={profile?.avatar_url ?? null} name={displayName(profile, user)} size={32} />
              <span className={styles.name}>{profile?.first_name || "Profile"}</span>
            </Link>
            <form action={signOut}>
              <button type="submit" className={styles.signOut}>
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link href="/login" className={styles.signIn}>
            Sign in
          </Link>
        )}
      </header>

      {user && !isProfileComplete(profile) && <ProfilePrompt />}
    </>
  );
}
