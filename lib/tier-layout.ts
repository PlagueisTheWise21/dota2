/**
 * Sizing for the tier list so every tier and team fits on screen without
 * scrolling.
 *
 * Strategy, in order of preference:
 * 1. Full-size cards in a board about 760px wide.
 * 2. Full-size cards, widening the board so each tier fits more teams per line.
 * 3. Shrinking the cards (down to MIN_SCALE) at the widest board available.
 *
 * The layout is chosen for the tallest possible arrangement (every team in
 * one tier), so it depends only on the team count and the screen size.
 * Moving teams between tiers then never changes the width or card size;
 * only the row heights change.
 *
 * The CSS in TierList is what actually lays the board out; this file only
 * predicts its height to choose the width and scale. Keep the numbers here
 * in sync with the classes and styles in TierList.
 */

/** Sizes at scale 1, in px. Everything except borders scales. */
export const BASE = {
  label: 64, // tier label column width
  cardWidth: 104,
  cardHeight: 82,
  logoArea: 60, // height of the logo part of a card (the rest is the name)
  logoPad: 2, // space around the logo inside its area
  nameFont: 10, // team name font size
  gap: 6, // between cards
  pad: 6, // inside a tier row, around the cards
  rowMinHeight: 104,
  sectionGap: 14, // between the tiers box and the Unranked box
} as const;

/** Outer border of the tiers box and of the Unranked box. */
export const BOX_BORDER = 3;
/** Border between tier rows and to the right of each label. */
export const ROW_BORDER = 2;

/** Board width when space allows; also the width of the copied image. */
export const PREFERRED_WIDTH = 760;
const MAX_WIDTH = 1280;
const MIN_SCALE = 0.45;
const SCALE_STEP = 0.025;

export type TierLayout = {
  /** Multiply every BASE size by this. */
  scale: number;
  /** Board width in px. */
  width: number;
  /** False when even the smallest cards do not fit (the area then scrolls). */
  fits: boolean;
};

/** Teams per line that fit in a board of the given width. */
function perLineFor(width: number, scale: number): number {
  const cardsArea =
    width - 2 * BOX_BORDER - BASE.label * scale - ROW_BORDER - 2 * BASE.pad * scale;
  const perLine = Math.floor(
    (cardsArea + BASE.gap * scale) / ((BASE.cardWidth + BASE.gap) * scale),
  );
  return Math.max(1, perLine);
}

/** Board width needed for exactly `perLine` teams per line. */
function widthFor(perLine: number, scale: number): number {
  return (
    2 * BOX_BORDER +
    BASE.label * scale +
    ROW_BORDER +
    2 * BASE.pad * scale +
    perLine * BASE.cardWidth * scale +
    (perLine - 1) * BASE.gap * scale
  );
}

function rowHeight(teamCount: number, perLine: number, scale: number): number {
  const lines = Math.max(1, Math.ceil(teamCount / perLine));
  const cards =
    lines * BASE.cardHeight * scale +
    (lines - 1) * BASE.gap * scale +
    2 * BASE.pad * scale;
  return Math.max(BASE.rowMinHeight * scale, cards);
}

/**
 * Board height with every team in a single row (5 ranked tiers + Unranked).
 * Splitting teams across rows never needs more lines than this, so any
 * arrangement fits once this does.
 */
function worstCaseHeight(
  teamCount: number,
  perLine: number,
  scale: number,
): number {
  const fullRow = rowHeight(teamCount, perLine, scale);
  const emptyRow = rowHeight(0, perLine, scale);
  const tiers = fullRow + 4 * emptyRow + 4 * ROW_BORDER + 2 * BOX_BORDER;
  const unranked = emptyRow + 2 * BOX_BORDER;
  return tiers + BASE.sectionGap * scale + unranked;
}

/** Picks the board width and card scale for the available space. */
export function computeTierLayout(
  availableWidth: number,
  availableHeight: number,
  teamCount: number,
): TierLayout {
  const preferredWidth = Math.min(PREFERRED_WIDTH, availableWidth);
  const widest = Math.min(MAX_WIDTH, availableWidth);

  for (let step = 0; ; step++) {
    const scale = Math.max(MIN_SCALE, 1 - step * SCALE_STEP);
    const minPerLine = perLineFor(preferredWidth, scale);
    const maxPerLine = perLineFor(widest, scale);

    for (let perLine = minPerLine; perLine <= maxPerLine; perLine++) {
      const width =
        perLine === minPerLine
          ? preferredWidth
          : // +1px so rounding never pushes the last card onto a new line.
            Math.ceil(widthFor(perLine, scale)) + 1;

      if (width > availableWidth) break;

      if (worstCaseHeight(teamCount, perLine, scale) <= availableHeight) {
        return { scale, width, fits: true };
      }
    }

    if (scale === MIN_SCALE) {
      return { scale, width: widest, fits: false };
    }
  }
}
