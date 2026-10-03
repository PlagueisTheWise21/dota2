/**
 * Fixed full-screen backdrop: near-black with rows of barely visible Dota
 * terms. Purely decorative, so it is hidden from screen readers and ignores
 * the mouse.
 */
const WORDS = [
  "ROSHAN",
  "AEGIS",
  "RAMPAGE",
  "GG WP",
  "MID OR FEED",
  "RADIANT",
  "DIRE",
  "BUYBACK",
  "DIVINE RAPIER",
  "SMOKE GANK",
  "HIGH GROUND",
  "GODLIKE",
  "FIRST BLOOD",
  "MEGA CREEPS",
  "BLACK KING BAR",
  "ULTRA KILL",
];

const ROW_COUNT = 14;

/** Each row starts at a different word so the rows do not line up. */
function rowText(row: number): string {
  const offset = (row * 5) % WORDS.length;
  const rotated = [...WORDS.slice(offset), ...WORDS.slice(0, offset)];
  return rotated.join("  /  ");
}

export function SiteBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink select-none"
    >
      <div className="absolute -inset-[20%] flex -rotate-6 flex-col justify-between">
        {Array.from({ length: ROW_COUNT }, (_, row) => (
          <p
            key={row}
            className="font-display text-[clamp(2rem,6vw,5rem)] leading-none font-bold tracking-widest whitespace-nowrap text-white/[0.035] uppercase"
          >
            {rowText(row)}
          </p>
        ))}
      </div>
    </div>
  );
}
