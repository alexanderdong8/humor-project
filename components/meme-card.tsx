import Image from "next/image";
import type { ReactNode } from "react";
import { MOODS, type MoodId } from "@/lib/moods";
import styles from "./game.module.css";

type Props = {
  imageUrl: string;
  caption: string | null;
  mood?: MoodId | null;
  badge?: ReactNode;
  footer?: ReactNode;
  sizes?: string;
  priority?: boolean;
  size?: "md" | "lg";
};

/** A post the way everyone sees it: the photo with its one caption underneath. */
export function MemeCard({ imageUrl, caption, mood, badge, footer, sizes = "(max-width: 860px) 100vw, 520px", priority, size = "md" }: Props) {
  return (
    <figure className={styles.meme} data-size={size}>
      <div className={styles.memePhoto}>
        {badge && <span className={styles.aiBadge}>{badge}</span>}
        <Image src={imageUrl} alt="" fill sizes={sizes} priority={priority} />
      </div>
      <figcaption className={styles.memeCaption}>
        {mood && (
          <span className={styles.moodTag}>
            {MOODS[mood].emoji} {MOODS[mood].label} remix
          </span>
        )}
        <span>{caption ?? "Caption coming soon…"}</span>
      </figcaption>
      {footer && <div className={styles.memeFooter}>{footer}</div>}
    </figure>
  );
}
