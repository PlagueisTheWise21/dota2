import { PLACE_COLORS, type PredictionSlots } from "@/components/Predictions";
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
import { placementGroups } from "@/lib/placements";

/**
 * Draws a predictions board as a PNG for "Copy image": the placement table
 * as on the page (components/Predictions.tsx), at a fixed comfortable size,
 * with the event name as a title. Teams not yet placed are left out.
 * Browser-only.
 */

const BOARD_WIDTH = 560;
const BOX_BORDER = 3;
const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 64;
const LABEL_BORDER = 2;
/** Space around a team box inside its slot. */
const SLOT_PAD = 4;
/** Line under the last slot of a group. */
const GROUP_LINE = 2;
/** Line between slots in the same group. */
const SLOT_LINE = 1;

function drawChip(
  context: CanvasRenderingContext2D,
  fonts: Fonts,
  team: EventTeam,
  logo: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  drawCardBox(context, x, y, width, height);

  // Logo square on the left, with a thin divider.
  const inner = height - 2 * CARD_BORDER;
  drawLogo(
    context,
    fonts,
    logo,
    team.short_name ?? team.name.slice(0, 3),
    11,
    x + CARD_BORDER + 2,
    y + CARD_BORDER + 2,
    inner - 4,
    inner - 4,
  );
  context.fillStyle = COLORS.cardDivider;
  context.fillRect(x + CARD_BORDER + inner, y + CARD_BORDER, CARD_BORDER, inner);

  // Name.
  const nameX = x + CARD_BORDER + inner + CARD_BORDER + 10;
  const nameWidth = x + width - CARD_BORDER - 10 - nameX;
  context.fillStyle = COLORS.paper;
  context.font = `600 15px ${fonts.body}`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  const [name] = wrapText(context, team.name, nameWidth, 1);
  context.fillText(name, nameX, y + height / 2);
}

/** Draws the predictions board and resolves with it as a PNG. */
export async function renderPredictionsPng(
  eventName: string,
  teams: EventTeam[],
  slots: PredictionSlots,
  pixelRatio = 2,
): Promise<Blob> {
  const [fonts, logos] = await Promise.all([
    loadFonts(),
    Promise.all(teams.map((team) => loadLogo(team.logo_url))),
  ]);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const logosById = new Map(teams.map((team, index) => [team.id, logos[index]]));
  const groups = placementGroups(teams.length);

  const boardHeight = 2 * BOX_BORDER + HEADER_HEIGHT + teams.length * ROW_HEIGHT;
  const width = BOARD_WIDTH + 2 * PADDING;
  const height =
    PADDING + TITLE_HEIGHT + TITLE_GAP + boardHeight + PADDING + PANEL_SHADOW;

  const { canvas, context } = createCanvas(width, height, pixelRatio);
  drawTitle(context, fonts, width, BOARD_WIDTH, eventName, "Predictions");

  // Board box.
  const boardX = PADDING;
  const boardY = PADDING + TITLE_HEIGHT + TITLE_GAP;
  drawBox(context, boardX, boardY, BOARD_WIDTH, boardHeight, {
    fill: COLORS.panel,
    border: BOX_BORDER,
    shadow: { offset: PANEL_SHADOW, color: COLORS.shadow },
  });

  const innerX = boardX + BOX_BORDER;
  const innerWidth = BOARD_WIDTH - 2 * BOX_BORDER;
  const slotX = innerX + LABEL_WIDTH + LABEL_BORDER;
  const slotWidth = innerX + innerWidth - slotX;

  // Header row: PLACE | TEAM.
  const headerY = boardY + BOX_BORDER;
  context.fillStyle = COLORS.labelGrey;
  context.fillRect(innerX, headerY, innerWidth, HEADER_HEIGHT);
  context.fillStyle = COLORS.black;
  context.fillRect(innerX, headerY + HEADER_HEIGHT - GROUP_LINE, innerWidth, GROUP_LINE);
  context.fillRect(innerX + LABEL_WIDTH, headerY, LABEL_BORDER, HEADER_HEIGHT);
  context.fillStyle = "rgba(232, 236, 241, 0.7)";
  context.font = `700 12px ${fonts.display}`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  withLetterSpacing(context, "2px", () => {
    context.fillText("PLACE", innerX + 8, headerY + HEADER_HEIGHT / 2);
    context.fillText("TEAM", slotX + 8, headerY + HEADER_HEIGHT / 2);
  });

  // Placement groups.
  let rowY = headerY + HEADER_HEIGHT;
  groups.forEach((group, groupIndex) => {
    const groupHeight = group.size * ROW_HEIGHT;
    const lastGroup = groupIndex === groups.length - 1;
    const medal = PLACE_COLORS[groupIndex];

    // Label spanning the group's rows.
    context.fillStyle = medal ?? COLORS.labelGrey;
    context.fillRect(innerX, rowY, LABEL_WIDTH, groupHeight);
    context.fillStyle = COLORS.black;
    context.fillRect(innerX + LABEL_WIDTH, rowY, LABEL_BORDER, groupHeight);
    context.fillStyle = medal ? COLORS.black : COLORS.paper;
    context.font = `700 18px ${fonts.display}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(group.label, innerX + LABEL_WIDTH / 2, rowY + groupHeight / 2);

    for (let offset = 0; offset < group.size; offset++) {
      const index = group.start + offset;
      const y = rowY + offset * ROW_HEIGHT;
      const lastInGroup = offset === group.size - 1;

      // Line under the slot: thick between groups, thin inside a group.
      if (!(lastInGroup && lastGroup)) {
        const line = lastInGroup ? GROUP_LINE : SLOT_LINE;
        context.fillStyle = lastInGroup ? COLORS.black : "rgba(0, 0, 0, 0.6)";
        context.fillRect(slotX, y + ROW_HEIGHT - line, slotWidth, line);
        if (lastInGroup) {
          context.fillRect(innerX, y + ROW_HEIGHT - line, LABEL_WIDTH, line);
        }
      }

      const boxX = slotX + SLOT_PAD;
      const boxY = y + SLOT_PAD;
      const boxWidth = slotWidth - 2 * SLOT_PAD;
      const boxHeight = ROW_HEIGHT - 2 * SLOT_PAD - (lastInGroup ? GROUP_LINE : SLOT_LINE);
      const teamId = slots[index];
      const team = teamId ? teamsById.get(teamId) : undefined;

      if (team) {
        drawChip(
          context,
          fonts,
          team,
          logosById.get(team.id) ?? null,
          boxX,
          boxY,
          boxWidth,
          boxHeight,
        );
      } else {
        // Empty slot: faint dashed outline, as on the page.
        context.save();
        context.strokeStyle = "rgba(255, 255, 255, 0.1)";
        context.lineWidth = 1;
        context.setLineDash([4, 3]);
        context.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1);
        context.restore();
      }
    }

    rowY += groupHeight;
  });

  return canvasToPng(canvas);
}
