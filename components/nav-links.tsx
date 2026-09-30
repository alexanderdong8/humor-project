"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./site-header.module.css";

type Props = { signedIn: boolean };

export function NavLinks({ signedIn }: Props) {
  const pathname = usePathname();
  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <nav className={styles.nav} aria-label="Main">
      <Link href="/jokes" aria-current={current("/jokes")}>
        Library
      </Link>
      {signedIn ? (
        <Link href="/members" aria-current={current("/members")}>
          Green Room
        </Link>
      ) : (
        <Link href="/login" className={styles.locked} title="Members only — sign in to enter">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z"
            />
          </svg>
          Green Room
        </Link>
      )}
    </nav>
  );
}
