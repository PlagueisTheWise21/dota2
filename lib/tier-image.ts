import type { Placements } from "@/components/TierList";
import { TIERS } from "@/components/TierList";
import type { EventTeam } from "@/lib/events";
import {
  CARD_BORDER,
  COLORS,
  PADDING,
  PANEL_SHADOW,
  TITLE_GAP,
  TITLE_HEIGHT,
  canvasToPng,
  createCanvas,
  drawBox,
  drawCardBox,
  drawLogo,
  drawTitle,
  loadFonts,
  loadLogo,
  withLetterSpacing,
  wrapText,
  type Fonts,
} from "@/lib/image-common";
import { BASE, BOX_BORDER, PREFERRED_WIDTH, ROW_BORDER } from "@/lib/tier-layout";

/**
 * Draws a tier list as a PNG for "Copy image".
 *
 * Drawn directly on a canvas with the same sizes and colours as the board on
 * the page (see TierBoard in components/TierList.tsx), at full card size, so
 * the image looks the same on any screen. Browser-only.
 */

function rowHeight(count: number, perLine: number): number {
  const lines = Math.max(1, Math.ceil(count / perLine));
  return Math.max(
    BASE.rowMinHeight,
    lines * BASE.cardHeight + (lines - 1) * BASE.gap + 2 * BASE.pad,
  );
}

function drawCard(
  context: CanvasRenderingContext2D,
  fonts: Fonts,
  team: EventTeam,
  logo: HTMLImageElement | null,
  x: number,
  y: number,
) {
  const width = BASE.cardWidth;
  const height = BASE.cardHeight;
  drawCardBox(context, x, y, width, height);

  // Logo area.
  const innerX = x + CARD_BORDER;
  const innerY = y + CARD_BORDER;
  const innerWidth = width - 2 * CARD_BORDER;
  drawLogo(
    context,
    fonts,
    logo,
    team.short_name ?? team.name.slice(0, 3),
    18,
    innerX + BASE.logoPad,
    innerY + BASE.logoPad,
    innerWidth - 2 * BASE.logoPad,
    BASE.logoArea - 2 * BASE.logoPad,
  );

  // Divider and name.
  const dividerY = innerY + BASE.logoArea;
  context.fillStyle = COLORS.cardDivider;
  context.fillRect(innerX, dividerY, innerWidth, CARD_BORDER);

  const nameTop = dividerY + CARD_BORDER;
  const nameHeight = y + height - CARD_BORDER - nameTop;
  context.fillStyle = COLORS.paper;
  context.font = `600 ${BASE.nameFont}px ${fonts.body}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const [name] = wrapText(context, team.name, innerWidth - 6, 1);
  context.fillText(name, innerX + innerWidth / 2, nameTop + nameHeight / 2);
}

/** Draws the tier list and resolves with it as a PNG. */
export async function renderTierListPng(
  eventName: string,
  teams: EventTeam[],
  placements: Placements,
  pixelRatio = 2,
): Promise<Blob> {
  const [fonts, logos] = await Promise.all([
    loadFonts(),
    Promise.all(teams.map((team) => loadLogo(team.logo_url))),
  ]);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const logosById = new Map(teams.map((team, index) => [team.id, logos[index]]));

  const boardWidth = PREFERRED_WIDTH;
  const cardsAreaWidth =
    boardWidth - 2 * BOX_BORDER - BASE.label - ROW_BORDER - 2 * BASE.pad;
  const perLine = Math.max(
    1,
    Math.floor((cardsAreaWidth + BASE.gap) / (BASE.cardWidth + BASE.gap)),
  );

  const rows: { id: (typeof TIERS)[number]["id"] | "unranked"; color: string }[] =
    TIERS.map((tier) => ({ id: tier.id, color: tier.color }));
  const showUnranked = placements.unranked.length > 0;

  // Measure everything first to size the canvas.
  const tierHeights = rows.map((row) => rowHeight(placements[row.id].length, perLine));
  const tiersBoxHeight =
    tierHeights.reduce((sum, h) => sum + h, 0) +
    (rows.length - 1) * ROW_BORDER +
    2 * BOX_BORDER;
  const unrankedBoxHeight = showUnranked
    ? rowHeight(placements.unranked.length, perLine) + 2 * BOX_BORDER
    : 0;

  const width = boardWidth + 2 * PADDING;
  const height =
    PADDING +
    TITLE_HEIGHT +
    TITLE_GAP +
    tiersBoxHeight +
    (showUnranked ? BASE.sectionGap + unrankedBoxHeight : 0) +
    PADDING +
    PANEL_SHADOW;

  const { canvas, context } = createCanvas(width, height, pixelRatio);
  drawTitle(context, fonts, width, boardWidth, eventName, "Tier list");

  function drawRows(
    list: typeof rows,
    heights: number[],
    boxY: number,
    boxHeight: number,
  ) {
    drawBox(context, PADDING, boxY, boardWidth, boxHeight, {
      fill: COLORS.black,
      border: BOX_BORDER,
      shadow: { offset: PANEL_SHADOW, color: COLORS.shadow },
    });
    let rowY = boxY + BOX_BORDER;
    list.forEach((row, index) => {
      const rowH = heights[index];
      const rowX = PADDING + BOX_BORDER;

      // Label.
      context.fillStyle = row.color;
      context.fillRect(rowX, rowY, BASE.label, rowH);
      context.textAlign = "center";
      context.textBaseline = "middle";
      if (row.id === "unranked") {
        context.save();
        context.translate(rowX + BASE.label / 2, rowY + rowH / 2);
        context.rotate(-Math.PI / 2);
        context.fillStyle = COLORS.paper;
        context.font = `700 13px ${fonts.display}`;
        withLetterSpacing(context, "2px", () => context.fillText("UNRANKED", 0, 0));
        context.restore();
      } else {
        context.fillStyle = COLORS.black;
        context.font = `700 30px ${fonts.display}`;
        context.fillText(row.id, rowX + BASE.label / 2, rowY + rowH / 2);
      }

      // Cards area.
      const areaX = rowX + BASE.label + ROW_BORDER;
      context.fillStyle = COLORS.panel;
      context.fillRect(areaX, rowY, cardsAreaWidth + 2 * BASE.pad, rowH);
      placements[row.id].forEach((teamId, cardIndex) => {
        const team = teamsById.get(teamId);
        if (!team) return;
        const column = cardIndex % perLine;
        const line = Math.floor(cardIndex / perLine);
        drawCard(
          context,
          fonts,
          team,
          logosById.get(teamId) ?? null,
          areaX + BASE.pad + column * (BASE.cardWidth + BASE.gap),
          rowY + BASE.pad + line * (BASE.cardHeight + BASE.gap),
        );
      });

      rowY += rowH + ROW_BORDER;
    });
  }

  const tiersY = PADDING + TITLE_HEIGHT + TITLE_GAP;
  drawRows(rows, tierHeights, tiersY, tiersBoxHeight);

  if (showUnranked) {
    drawRows(
      [{ id: "unranked", color: COLORS.labelGrey }],
      [rowHeight(placements.unranked.length, perLine)],
      tiersY + tiersBoxHeight + BASE.sectionGap,
      unrankedBoxHeight,
    );
  }

  return canvasToPng(canvas);
}
