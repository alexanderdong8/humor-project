// Safe to import from client components (no server code here).

import type { MoodId } from "@/lib/moods";

/** One side of a battle: a published post and the one caption its owner picked. */
export type Contender = {
  id: string;
  image_url: string;
  caption: string;
  mood: MoodId | null;
  author_name: string | null;
  theme: string | null;
  battle_wins: number;
  battle_losses: number;
};

export type Matchup = { left: Contender; right: Contender; remaining: number };

/** A matchup as stored: the two post ids in order, joined by a colon. */
export function matchKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
