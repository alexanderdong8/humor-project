import Link from "next/link";
import { site } from "@/lib/site";
import { Logo } from "./logo";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Logo />
          <p>{site.tagline}</p>
        </div>
        <nav className={styles.links} aria-label="Footer">
          <Link href="/jokes">Library</Link>
          <Link href="/members">Green Room</Link>
          <Link href="/profile">Profile</Link>
        </nav>
        <p className={styles.fine}>© {new Date().getFullYear()} {site.name}. Please groan responsibly.</p>
      </div>
    </footer>
  );
}
