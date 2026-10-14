// Safe to import from client components (no server code here).

/** Remix moods. `prompt` goes to the model; the rest is shown on buttons and caption tags. */
export const MOODS = {
  meaner: {
    emoji: "😈",
    label: "Meaner",
    prompt:
      "Roast mode: sharper, more savage, more cutting than the existing captions. Roast the situation, the object, or the vibe, never anyone's body, looks, or identity. Still PG-13.",
  },
  funnier: {
    emoji: "😂",
    label: "Funnier",
    prompt:
      "Go for the biggest possible laugh: absurd escalation, unexpected twists, tighter punchlines, and better word choice than the existing captions.",
  },
  relatable: {
    emoji: "🫠",
    label: "Relatable",
    prompt:
      "Painfully relatable for college students: 'me when...' energy, being broke, procrastinating, dorm life, group chats, being new to New York. The reader should think 'this is literally me.'",
  },
} as const;

export type MoodId = keyof typeof MOODS;

export function isMood(value: unknown): value is MoodId {
  return typeof value === "string" && value in MOODS;
}
