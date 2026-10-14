"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./site-header.module.css";

type Props = { signedIn: boolean };

export function NavLinks({ signedIn }: Props) {
  const pathname = usePathname();
  const current = (prefix: string) => (pathname === prefix || pathname.startsWith(`${prefix}/`) ? "page" : undefined);

  return (
    <nav className={styles.nav} aria-label="Main">
      <Link href="/battle" aria-current={current("/battle")}>
        <span aria-hidden="true">⚔️</span> Battle
      </Link>
      <Link href="/jokes" aria-current={current("/jokes")}>
        <span aria-hidden="true">📚</span> Jokes
      </Link>
      <Link
        href={signedIn ? "/members" : "/login"}
        aria-current={current("/members")}
        title={signedIn ? undefined : "Members only: sign in to enter"}
      >
        <span aria-hidden="true">{signedIn ? "🎤" : "🔒"}</span> Green Room
      </Link>
    </nav>
  );
}
