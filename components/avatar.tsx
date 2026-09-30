import styles from "./account.module.css";

type Props = { url: string | null; name: string; size?: number };

/** Profile photo, or the member's initials when they haven't uploaded one. */
export function Avatar({ url, name, size = 40 }: Props) {
  const initials =
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {url ? (
        <img src={url} alt="" width={size} height={size} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
