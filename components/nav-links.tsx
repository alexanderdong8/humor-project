"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./site-header.module.css";

const LINKS = [
  { href: "/battle", emoji: "⚔️", label: "Battle", match: ["/battle", "/post"] },
  { href: "/top", emoji: "🏆", label: "Top", match: ["/top"] },
  { href: "/daily", emoji: "🤖", label: "Daily", match: ["/daily"] },
  { href: "/jokes", emoji: "📚", label: "Jokes", match: ["/jokes"] },
];

export function NavLinks() {
  const pathname = usePathname();
  const isCurrent = (prefixes: string[]) =>
    prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ? "page" : undefined;

  return (
    <nav className={styles.nav} aria-label="Main">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={isCurrent(link.match)}>
          <span aria-hidden="true">{link.emoji}</span> {link.label}
        </Link>
      ))}
    </nav>
  );
}
