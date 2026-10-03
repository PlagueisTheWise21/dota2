import type { Placements } from "@/components/TierList";
import { TIERS } from "@/components/TierList";
import type { EventTeam } from "@/lib/events";
import { BASE, BOX_BORDER, PREFERRED_WIDTH, ROW_BORDER } from "@/lib/tier-layout";

/**
 * Draws a tier list as a PNG for "Copy image".
 *
 * Drawn directly on a canvas with the same sizes and colours as the board on
 * the page (see TierBoard in components/TierList.tsx), at full card size, so
 * the image looks the same on any screen. Browser-only.
 */

const COLORS = {
  ink: "#0b0b0b",
  panel: "#161616",
  paper: "#e8ecf1",
  steel: "#2c3e55",
  shadow: "#4a607a",
  logoBack: "#1e1e1e",
  unrankedLabel: "#2a2a2a",
  black: "#000000",
};

const PADDING = 32;
const TITLE_GAP = 24;
const PANEL_SHADOW = 6;
const CARD_SHADOW = 2;
const LOGO_AREA = 52;
const LOGO_PAD = 4;
const CARD_BORDER = 2;

type Fonts = { display: string; body: string };

/** Font families as the page resolved them (next/font gives generated names). */
async function loadFonts(): Promise<Fonts> {
  const probe = document.createElement("span");
  probe.className = "font-display";
  document.body.appendChild(probe);
  const display = getComputedStyle(probe).fontFamily;
  probe.remove();
  const body = getComputedStyle(document.body).fontFamily;
  await Promise.all([
    document.fonts.load(`700 30px ${display}`),
    document.fonts.load(`600 11px ${body}`),
    document.fonts.load(`500 13px ${body}`),
  ]);
  return { display, body };
}

/** Loads a logo through app/api/logo/route.ts; null if it fails. */
function loadLogo(logoUrl: string | null): Promise<HTMLImageElement | null> {
  if (!logoUrl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => resolve(null), 10000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = `/api/logo?url=${encodeURIComponent(logoUrl)}`;
  });
}

function rowHeight(count: number, perLine: number): number {
  const lines = Math.max(1, Math.ceil(count / perLine));
  return Math.max(
    BASE.rowMinHeight,
    lines * BASE.cardHeight + (lines - 1) * BASE.gap + 2 * BASE.pad,
  );
}

/** Splits text into at most `maxLines` lines that fit `maxWidth`. */
function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  // Break on spaces, and inside words that are too long on their own.
  const pieces = text.split(" ").flatMap((word) => {
    if (context.measureText(word).width <= maxWidth) return [word];
    const parts: string[] = [];
    let part = "";
    for (const char of word) {
      if (context.measureText(part + char).width > maxWidth && part) {
        parts.push(part);
        part = char;
      } else {
        part += char;
      }
    }
    return [...parts, part];
  });

  for (const piece of pieces) {
    const next = line ? `${line} ${piece}` : piece;
    if (context.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = piece;
    }
  }
  if (line) lines.push(line);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && context.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/** Draws with letter spacing where the browser supports it on canvas. */
function withLetterSpacing(
  context: CanvasRenderingContext2D,
  spacing: string,
  draw: () => void,
) {
  const supported = "letterSpacing" in context;
  if (supported) context.letterSpacing = spacing;
  draw();
  if (supported) context.letterSpacing = "0px";
}

/** A filled box with a solid offset shadow and an inset black border. */
function drawBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill: string; border: number; shadow?: { offset: number; color: string } },
) {
  if (options.shadow) {
    context.fillStyle = options.shadow.color;
    context.fillRect(
      x + options.shadow.offset,
      y + options.shadow.offset,
      width,
      height,
    );
  }
  context.fillStyle = COLORS.black;
  context.fillRect(x, y, width, height);
  context.fillStyle = options.fill;
  context.fillRect(
    x + options.border,
    y + options.border,
    width - 2 * options.border,
    height - 2 * options.border,
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
  drawBox(context, x, y, width, height, {
    fill: COLORS.paper,
    border: CARD_BORDER,
    shadow: { offset: CARD_SHADOW, color: COLORS.black },
  });

  // Logo area.
  const innerX = x + CARD_BORDER;
  const innerY = y + CARD_BORDER;
  const innerWidth = width - 2 * CARD_BORDER;
  context.fillStyle = COLORS.logoBack;
  context.fillRect(innerX, innerY, innerWidth, LOGO_AREA);

  const boxWidth = innerWidth - 2 * LOGO_PAD;
  const boxHeight = LOGO_AREA - 2 * LOGO_PAD;
  if (logo) {
    const fit = Math.min(boxWidth / logo.naturalWidth, boxHeight / logo.naturalHeight);
    const drawWidth = logo.naturalWidth * fit;
    const drawHeight = logo.naturalHeight * fit;
    context.drawImage(
      logo,
      innerX + LOGO_PAD + (boxWidth - drawWidth) / 2,
      innerY + LOGO_PAD + (boxHeight - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
  } else {
    context.fillStyle = COLORS.paper;
    context.font = `700 18px ${fonts.display}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      (team.short_name ?? team.name.slice(0, 3)).toUpperCase(),
      innerX + innerWidth / 2,
      innerY + LOGO_AREA / 2,
    );
  }

  // Divider and name.
  const dividerY = innerY + LOGO_AREA;
  context.fillStyle = COLORS.black;
  context.fillRect(innerX, dividerY, innerWidth, ROW_BORDER);

  const nameTop = dividerY + ROW_BORDER;
  const nameHeight = y + height - CARD_BORDER - nameTop;
  context.fillStyle = COLORS.steel;
  context.font = `600 11px ${fonts.body}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const lines = wrapText(context, team.name, innerWidth - 6, 2);
  const lineHeight = 12.5;
  const firstLineY = nameTop + nameHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, innerX + innerWidth / 2, firstLineY + index * lineHeight);
  });
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
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `700 30px ${fonts.display}`;
  const titleText = eventName.toUpperCase();
  const titleWidth = Math.min(
    boardWidth,
    Math.ceil(measure.measureText(titleText).width) + 80,
  );
  const titleHeight = 72;

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
    titleHeight +
    TITLE_GAP +
    tiersBoxHeight +
    (showUnranked ? BASE.sectionGap + unrankedBoxHeight : 0) +
    PADDING +
    PANEL_SHADOW;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.scale(pixelRatio, pixelRatio);

  context.fillStyle = COLORS.ink;
  context.fillRect(0, 0, width, height);

  // Title panel.
  const titleX = (width - titleWidth) / 2;
  drawBox(context, titleX, PADDING, titleWidth, titleHeight, {
    fill: COLORS.paper,
    border: BOX_BORDER,
    shadow: { offset: PANEL_SHADOW, color: COLORS.shadow },
  });
  context.fillStyle = COLORS.steel;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 30px ${fonts.display}`;
  context.fillText(titleText, width / 2, PADDING + 28, boardWidth - 40);
  context.font = `500 13px ${fonts.body}`;
  withLetterSpacing(context, "3px", () =>
    context.fillText("TIER LIST", width / 2, PADDING + 54),
  );

  function drawRows(
    list: typeof rows,
    heights: number[],
    boxY: number,
    boxHeight: number,
  ) {
    drawBox(context!, PADDING, boxY, boardWidth, boxHeight, {
      fill: COLORS.black,
      border: BOX_BORDER,
      shadow: { offset: PANEL_SHADOW, color: COLORS.shadow },
    });
    let rowY = boxY + BOX_BORDER;
    list.forEach((row, index) => {
      const rowH = heights[index];
      const rowX = PADDING + BOX_BORDER;

      // Label.
      context!.fillStyle = row.color;
      context!.fillRect(rowX, rowY, BASE.label, rowH);
      if (row.id === "unranked") {
        context!.save();
        context!.translate(rowX + BASE.label / 2, rowY + rowH / 2);
        context!.rotate(-Math.PI / 2);
        context!.fillStyle = COLORS.paper;
        context!.font = `700 13px ${fonts.display}`;
        withLetterSpacing(context!, "2px", () =>
          context!.fillText("UNRANKED", 0, 0),
        );
        context!.restore();
      } else {
        context!.fillStyle = COLORS.black;
        context!.font = `700 30px ${fonts.display}`;
        context!.fillText(row.id, rowX + BASE.label / 2, rowY + rowH / 2);
      }

      // Cards area.
      const areaX = rowX + BASE.label + ROW_BORDER;
      context!.fillStyle = COLORS.panel;
      context!.fillRect(areaX, rowY, cardsAreaWidth + 2 * BASE.pad, rowH);
      placements[row.id].forEach((teamId, cardIndex) => {
        const team = teamsById.get(teamId);
        if (!team) return;
        const column = cardIndex % perLine;
        const line = Math.floor(cardIndex / perLine);
        drawCard(
          context!,
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

  const tiersY = PADDING + titleHeight + TITLE_GAP;
  drawRows(rows, tierHeights, tiersY, tiersBoxHeight);

  if (showUnranked) {
    drawRows(
      [{ id: "unranked", color: COLORS.unrankedLabel }],
      [rowHeight(placements.unranked.length, perLine)],
      tiersY + tiersBoxHeight + BASE.sectionGap,
      unrankedBoxHeight,
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image was empty"))),
      "image/png",
    );
  });
}
