type Mood = "happy" | "laughing" | "sad" | "sleepy" | "wow";

type Props = { mood?: Mood; size?: number; className?: string; title?: string };

/** Mic, Punchline's mascot: a microphone with a face that changes with the moment. */
export function Mascot({ mood = "happy", size = 64, className, title }: Props) {
  return (
    <svg
      viewBox="0 0 64 72"
      width={size}
      height={(size * 72) / 64}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* Handle and collar */}
      <rect x="26" y="44" width="12" height="24" rx="6" fill="#1f1b16" />
      <rect x="21" y="40" width="22" height="9" rx="4.5" fill="#ff6b4a" stroke="#1f1b16" strokeWidth="2.5" />
      {/* Head */}
      <circle cx="32" cy="24" r="20" fill="#ffd23f" stroke="#1f1b16" strokeWidth="2.5" />
      {/* Cheeks */}
      <ellipse cx="18.5" cy="29" rx="3.6" ry="2.4" fill="#ff9ccf" opacity="0.9" />
      <ellipse cx="45.5" cy="29" rx="3.6" ry="2.4" fill="#ff9ccf" opacity="0.9" />
      <Face mood={mood} />
    </svg>
  );
}

function Face({ mood }: { mood: Mood }) {
  const stroke = { stroke: "#1f1b16", strokeWidth: 2.6, strokeLinecap: "round" as const, fill: "none" };

  switch (mood) {
    case "laughing":
      return (
        <>
          <path d="M21 21.5q3.5-4.5 7 0" {...stroke} />
          <path d="M36 21.5q3.5-4.5 7 0" {...stroke} />
          <path d="M22.5 27h19a9.5 9.5 0 0 1-19 0Z" fill="#1f1b16" />
          <path d="M27 33.2a6 4 0 0 1 10 0a8 8 0 0 1-10 0Z" fill="#ff6b4a" />
        </>
      );
    case "sad":
      return (
        <>
          <circle cx="25" cy="21" r="2.4" fill="#1f1b16" />
          <circle cx="39" cy="21" r="2.4" fill="#1f1b16" />
          <path d="M25 33q7-6 14 0" {...stroke} />
          <path d="M41 25.5q1.6 3 0 4.4q-1.6-1.4 0-4.4Z" fill="#6cc4ff" />
        </>
      );
    case "sleepy":
      return (
        <>
          <path d="M21.5 22q3.5 3 7 0" {...stroke} />
          <path d="M35.5 22q3.5 3 7 0" {...stroke} />
          <ellipse cx="32" cy="31" rx="2.6" ry="2" fill="#1f1b16" />
        </>
      );
    case "wow":
      return (
        <>
          <circle cx="25" cy="20.5" r="2.8" fill="#1f1b16" />
          <circle cx="39" cy="20.5" r="2.8" fill="#1f1b16" />
          <ellipse cx="32" cy="31" rx="4" ry="5" fill="#1f1b16" />
        </>
      );
    default:
      return (
        <>
          <circle cx="25" cy="21" r="2.6" fill="#1f1b16" />
          <circle cx="39" cy="21" r="2.6" fill="#1f1b16" />
          <path d="M24 28q8 8 16 0" {...stroke} />
        </>
      );
  }
}
