"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFavoriteCategory } from "./actions";
import styles from "@/components/account.module.css";

type Props = { categories: { name: string; emoji: string }[]; current: string | null };

/** Tap a category to fill your joke set with it; "Surprise me" mixes everything. */
export function FavoritePicker({ categories, current }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(category: string | null) {
    if (pending || category === selected) return;
    const previous = selected;
    setSelected(category);
    setError(null);
    startTransition(async () => {
      const result = await setFavoriteCategory(category);
      if (result.error) {
        setSelected(previous);
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  const options = [{ name: null, label: "Surprise me", emoji: "🎲" }, ...categories.map((c) => ({ name: c.name, label: c.name, emoji: c.emoji }))];

  return (
    <div>
      <div className={styles.favorites} role="radiogroup" aria-label="Favorite kind of joke" aria-busy={pending}>
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={selected === o.name}
            className={styles.favorite}
            onClick={() => pick(o.name)}
            disabled={pending}
          >
            <span aria-hidden="true">{o.emoji}</span> {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
