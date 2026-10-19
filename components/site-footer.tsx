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
          <Link href="/upload">Upload</Link>
          <Link href="/vote">Vote</Link>
          <Link href="/top">Leaderboard</Link>
          <Link href="/daily">Daily AI Meme</Link>
          <Link href="/jokes">Joke Library</Link>
          <Link href="/members">Green Room</Link>
        </nav>
        <p className={styles.fine}>
          © {new Date().getFullYear()} {site.name}. Made with puns in New York. Please groan responsibly.
        </p>
      </div>
    </footer>
  );
}
