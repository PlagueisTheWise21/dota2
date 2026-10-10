import type { Slots, SlotGroup } from "@/components/SlotBoard";
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
import {
  grandFinal,
  groupIndexOfSlot,
  groupName,
  groupSegments,
  realWinner,
  resolveBracket,
  roundNames,
  groupPlaces,
  swissGroups,
  swissPickCorrect,
  type PickemData,
  type BracketMatch,
  type BracketPicks,
  type ResolvedMatch,
} from "@/lib/pickems";

/**
 * Draws pick'em pictures for "Copy image" (group stage picks or the playoff
 * bracket), in the same style as the page (components/Pickems.tsx).
 * Browser-only.
 */

const GREEN = "#22c55e";
const RED = "#ef4444";

type Result = "correct" | "wrong" | null;

async function loadLogos(teams: EventTeam[]) {
  const logos = await Promise.all(teams.map((team) => loadLogo(team.logo_url)));
  return new Map(teams.map((team, index) => [team.id, logos[index]]));
}

/** A team row: logo square, divider, name, optional ✓/✗ and coloured outline. */
function drawChip(
  context: CanvasRenderingContext2D,
  fonts: Fonts,
  team: EventTeam,
  logo: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { result?: Result; fontSize?: number } = {},
) {
  drawCardBox(context, x, y, width, height);
  if (options.result) {
    context.strokeStyle = options.result === "correct" ? GREEN : RED;
    context.lineWidth = CARD_BORDER;
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }

  const inner = height - 2 * CARD_BORDER;
  drawLogo(
    context,
    fonts,
    logo,
    team.short_name ?? team.name.slice(0, 3),
    10,
    x + CARD_BORDER + 2,
    y + CARD_BORDER + 2,
    inner - 4,
    inner - 4,
  );
  context.fillStyle = COLORS.cardDivider;
  context.fillRect(x + CARD_BORDER + inner, y + CARD_BORDER, CARD_BORDER, inner);

  const markWidth = options.result ? 18 : 0;
  const nameX = x + CARD_BORDER + inner + CARD_BORDER + 8;
  const nameWidth = x + width - CARD_BORDER - 8 - markWidth - nameX;
  context.fillStyle = COLORS.paper;
  context.font = `600 ${options.fontSize ?? 14}px ${fonts.body}`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  const [name] = wrapText(context, team.name, nameWidth, 1);
  context.fillText(name, nameX, y + height / 2);

  if (options.result) {
    context.fillStyle = options.result === "correct" ? GREEN : RED;
    context.font = `700 14px ${fonts.body}`;
    context.textAlign = "center";
    context.fillText(options.result === "correct" ? "✓" : "✗", x + width - CARD_BORDER - 11, y + height / 2);
  }
}

// --- Group stage --------------------------------------------------------------

const GROUP_BOARD_WIDTH = 560;
const GROUP_HEADER = 30;
const GROUP_ROW = 44;
const GROUP_LABEL = 84;
const BOARD_TITLE = 26;
const BOARD_GAP = 26;

/** One board of group picks (Swiss has one; round-robin/GSL one per group). */
export type GroupBoard = {
  /** Shown above the board, e.g. "Group A"; none for Swiss. */
  title?: string;
  teams: EventTeam[];
  groups: SlotGroup[];
  slots: Slots;
  /** Right or wrong per filled slot, once results are known. */
  resultFor?: (index: number, teamId: string) => Result;
};

/** The boards to draw for the event's group format, with right/wrong marks. */
export function groupBoards(teams: EventTeam[], data: PickemData, slots: Slots): GroupBoard[] {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const pick = (ids: string[]) =>
    ids.map((id) => teamsById.get(id)).filter((team): team is EventTeam => Boolean(team));

  if (data.groupFormat === "swiss") {
    const groups = swissGroups(data.groupTeamIds.length);
    const records = new Map((data.groupRecords ?? []).map((r) => [r.teamId, r]));
    return [
      {
        teams: pick(data.groupTeamIds),
        groups,
        slots,
        resultFor: data.groupRecords
          ? (index, teamId) => {
              const record = records.get(teamId);
              if (!record) return null;
              return swissPickCorrect(groupIndexOfSlot(groups, index), record) ? "correct" : "wrong";
            }
          : undefined,
      },
    ];
  }

  if (data.groupFormat === "groups") {
    const segments = groupSegments(data);
    const placements = data.groupPlacements;
    return data.groups.map((group, index) => ({
      title: groupName(group.index),
      teams: pick(group.teamIds),
      groups: groupPlaces(group.teamIds.length, group.advance, group.continues),
      slots: slots.slice(segments[index].offset, segments[index].offset + segments[index].size),
      resultFor: placements
        ? (slot: number, teamId: string) =>
            placements[teamId] === undefined ? null : placements[teamId] === slot + 1 ? "correct" : "wrong"
        : undefined,
    }));
  }

  return [];
}

/** Your group stage picks as a PNG (empty slots are dashed). */
export async function renderGroupPickemPng(
  eventName: string,
  boards: GroupBoard[],
  pixelRatio = 2,
): Promise<Blob> {
  const allTeams = [...new Map(boards.flatMap((b) => b.teams).map((t) => [t.id, t])).values()];
  const [fonts, logos] = await Promise.all([loadFonts(), loadLogos(allTeams)]);

  const boardHeight = (board: GroupBoard) => 6 + GROUP_HEADER + board.slots.length * GROUP_ROW;
  const boardsHeight = boards.reduce(
    (sum, board, index) =>
      sum + (board.title ? BOARD_TITLE : 0) + boardHeight(board) + (index > 0 ? BOARD_GAP : 0),
    0,
  );
  const width = GROUP_BOARD_WIDTH + 2 * PADDING;
  const height = PADDING + TITLE_HEIGHT + TITLE_GAP + boardsHeight + PADDING + PANEL_SHADOW;
  const { canvas, context } = createCanvas(width, height, pixelRatio);
  drawTitle(context, fonts, width, GROUP_BOARD_WIDTH, eventName, "Pick'em · Group stage");

  let y = PADDING + TITLE_HEIGHT + TITLE_GAP;
  boards.forEach((board, index) => {
    if (index > 0) y += BOARD_GAP;
    if (board.title) {
      context.fillStyle = "rgba(232, 236, 241, 0.75)";
      context.font = `700 14px ${fonts.display}`;
      context.textAlign = "left";
      context.textBaseline = "middle";
      withLetterSpacing(context, "2px", () =>
        context.fillText(board.title!.toUpperCase(), PADDING, y + BOARD_TITLE / 2 - 3),
      );
      y += BOARD_TITLE;
    }
    drawGroupBoard(context, fonts, board, logos, PADDING, y);
    y += boardHeight(board);
  });

  return canvasToPng(canvas);
}

function drawGroupBoard(
  context: CanvasRenderingContext2D,
  fonts: Fonts,
  board: GroupBoard,
  logos: Map<string, HTMLImageElement | null>,
  boardX: number,
  boardY: number,
) {
  const { groups, slots, resultFor } = board;
  const teamsById = new Map(board.teams.map((team) => [team.id, team]));
  const picked = slots.filter(Boolean).length;
  const results = slots.map((id, index) => (id && resultFor ? resultFor(index, id) : null));
  const hasResults = results.some(Boolean);
  const correct = results.filter((r) => r === "correct").length;

  const boardHeight = 6 + GROUP_HEADER + slots.length * GROUP_ROW;
  drawBox(context, boardX, boardY, GROUP_BOARD_WIDTH, boardHeight, {
    fill: COLORS.panel,
    border: 3,
    shadow: { offset: PANEL_SHADOW, color: COLORS.shadow },
  });
  const innerX = boardX + 3;
  const innerWidth = GROUP_BOARD_WIDTH - 6;
  const slotX = innerX + GROUP_LABEL + 2;
  const slotWidth = innerX + innerWidth - slotX;

  // Header row.
  const headerY = boardY + 3;
  context.fillStyle = COLORS.labelGrey;
  context.fillRect(innerX, headerY, innerWidth, GROUP_HEADER);
  context.fillStyle = COLORS.black;
  context.fillRect(innerX, headerY + GROUP_HEADER - 2, innerWidth, 2);
  context.fillRect(innerX + GROUP_LABEL, headerY, 2, GROUP_HEADER);
  context.fillStyle = "rgba(232, 236, 241, 0.7)";
  context.font = `700 12px ${fonts.display}`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  withLetterSpacing(context, "2px", () => {
    context.fillText("RESULT", innerX + 8, headerY + GROUP_HEADER / 2);
    context.fillText(
      hasResults ? `PICKS · ${correct}/${picked} CORRECT` : `PICKS · ${picked}/${slots.length}`,
      slotX + 8,
      headerY + GROUP_HEADER / 2,
    );
  });

  let rowY = headerY + GROUP_HEADER;
  let slotIndex = 0;
  groups.forEach((group, groupIndex) => {
    const groupHeight = group.size * GROUP_ROW;
    const lastGroup = groupIndex === groups.length - 1;

    context.fillStyle = group.color ?? COLORS.labelGrey;
    context.fillRect(innerX, rowY, GROUP_LABEL, groupHeight);
    context.fillStyle = COLORS.black;
    context.fillRect(innerX + GROUP_LABEL, rowY, 2, groupHeight);
    context.fillStyle = group.color ? COLORS.black : COLORS.paper;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const middle = rowY + groupHeight / 2;
    const compact = groupHeight < 50;
    context.font = `700 ${compact ? 15 : 18}px ${fonts.display}`;
    context.fillText(group.label, innerX + GROUP_LABEL / 2, group.sublabel ? middle - (compact ? 6 : 7) : middle);
    if (group.sublabel) {
      context.font = `600 ${compact ? 9 : 10}px ${fonts.body}`;
      context.fillText(group.sublabel, innerX + GROUP_LABEL / 2, middle + (compact ? 9 : 11));
    }

    for (let offset = 0; offset < group.size; offset++, slotIndex++) {
      const y = rowY + offset * GROUP_ROW;
      const lastInGroup = offset === group.size - 1;
      if (!(lastInGroup && lastGroup)) {
        const line = lastInGroup ? 2 : 1;
        context.fillStyle = lastInGroup ? COLORS.black : "rgba(0, 0, 0, 0.6)";
        context.fillRect(slotX, y + GROUP_ROW - line, slotWidth, line);
        if (lastInGroup) context.fillRect(innerX, y + GROUP_ROW - line, GROUP_LABEL, line);
      }

      const boxX = slotX + 4;
      const boxY = y + 4;
      const boxWidth = slotWidth - 8;
      const boxHeight = GROUP_ROW - 8 - (lastInGroup ? 2 : 1);
      const teamId = slots[slotIndex];
      const team = teamId ? teamsById.get(teamId) : undefined;
      if (team) {
        drawChip(context, fonts, team, logos.get(team.id) ?? null, boxX, boxY, boxWidth, boxHeight, {
          result: results[slotIndex],
        });
      } else {
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
}

// --- Playoffs -----------------------------------------------------------------

const COLUMN_WIDTH = 190;
const COLUMN_GAP = 16;
const TEAM_ROW = 30;
const CARD_HEIGHT = TEAM_ROW * 2 + 1;
const CARD_GAP = 12;
const SECTION_HEADER = 22;
const SECTION_GAP = 26;
const CHAMPION_HEIGHT = 48;

/** Your playoff bracket picks as a PNG. */
export async function renderBracketPng(
  eventName: string,
  teams: EventTeam[],
  matches: BracketMatch[],
  picks: BracketPicks,
  pixelRatio = 2,
): Promise<Blob> {
  const [fonts, logos] = await Promise.all([loadFonts(), loadLogos(teams)]);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const { resolved } = resolveBracket(matches, picks);
  const names = roundNames(matches);
  const final = grandFinal(matches);
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const sections = (["upper", "lower"] as const).filter((section) =>
    matches.some((m) => m.section === section),
  );

  // Height of each section: its fullest column.
  const sectionHeight = (section: "upper" | "lower") => {
    const most = Math.max(
      ...rounds.map((round) => matches.filter((m) => m.section === section && m.round === round).length),
    );
    return most * CARD_HEIGHT + (most - 1) * CARD_GAP;
  };

  const boardWidth = rounds.length * COLUMN_WIDTH + (rounds.length - 1) * COLUMN_GAP;
  const width = boardWidth + 2 * PADDING;
  const sectionsHeight = sections.reduce(
    (sum, section, index) => sum + SECTION_HEADER + sectionHeight(section) + (index > 0 ? SECTION_GAP : 0),
    0,
  );
  const height =
    PADDING + TITLE_HEIGHT + TITLE_GAP + sectionsHeight + SECTION_GAP + CHAMPION_HEIGHT + PADDING + PANEL_SHADOW;
  const { canvas, context } = createCanvas(width, height, pixelRatio);
  drawTitle(context, fonts, width, Math.min(boardWidth, 760), eventName, "Pick'em · Playoffs");

  const columnX = (round: number) => PADDING + rounds.indexOf(round) * (COLUMN_WIDTH + COLUMN_GAP);
  let y = PADDING + TITLE_HEIGHT + TITLE_GAP;

  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) y += SECTION_GAP;
    const areaHeight = sectionHeight(section);

    for (const round of rounds) {
      const x = columnX(round);
      const label = names.get(`${section}:${round}`);
      if (label) {
        context.fillStyle = "rgba(232, 236, 241, 0.6)";
        context.font = `700 11px ${fonts.display}`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        withLetterSpacing(context, "2px", () =>
          context.fillText(label.toUpperCase(), x + COLUMN_WIDTH / 2, y + SECTION_HEADER / 2 - 2, COLUMN_WIDTH),
        );
      }

      // Spread the round's matches evenly down the section (justify-around).
      const inRound = matches
        .filter((m) => m.section === section && m.round === round)
        .sort((a, b) => a.number - b.number);
      const share = areaHeight / Math.max(1, inRound.length);
      inRound.forEach((match, index) => {
        const cardY = y + SECTION_HEADER + index * share + (share - CARD_HEIGHT) / 2;
        drawMatch(context, fonts, resolved.get(match.id)!, teamsById, logos, x, cardY);
      });
    }
    y += SECTION_HEADER + areaHeight;
  });

  // Champion box.
  y += SECTION_GAP;
  const champion = final ? resolved.get(final.id)?.pick : null;
  const team = champion ? teamsById.get(champion) : undefined;
  const boxWidth = 360;
  const boxX = (width - boxWidth) / 2;
  drawBox(context, boxX, y, boxWidth, CHAMPION_HEIGHT, {
    fill: COLORS.panel,
    border: 2,
    borderColor: COLORS.cardOutline,
    shadow: { offset: PANEL_SHADOW, color: COLORS.shadow },
  });
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.fillStyle = "rgba(232, 236, 241, 0.6)";
  context.font = `700 12px ${fonts.display}`;
  withLetterSpacing(context, "2px", () => context.fillText("CHAMPION", boxX + 16, y + CHAMPION_HEIGHT / 2));
  if (team) {
    drawLogo(context, fonts, logos.get(team.id) ?? null, team.short_name ?? team.name.slice(0, 3), 10, boxX + 110, y + 9, 30, 30);
    context.fillStyle = COLORS.paper;
    context.font = `700 20px ${fonts.display}`;
    context.textAlign = "left";
    context.fillText(team.name.toUpperCase(), boxX + 150, y + CHAMPION_HEIGHT / 2, boxWidth - 166);
  } else {
    context.fillStyle = "rgba(232, 236, 241, 0.4)";
    context.font = `500 13px ${fonts.body}`;
    context.fillText("Not picked yet", boxX + 110, y + CHAMPION_HEIGHT / 2);
  }

  return canvasToPng(canvas);
}

function drawMatch(
  context: CanvasRenderingContext2D,
  fonts: Fonts,
  entry: ResolvedMatch,
  teamsById: Map<string, EventTeam>,
  logos: Map<string, HTMLImageElement | null>,
  x: number,
  y: number,
) {
  drawCardBox(context, x, y, COLUMN_WIDTH, CARD_HEIGHT);
  const winner = realWinner(entry.match);

  entry.teams.forEach((teamId, index) => {
    const rowY = y + index * (TEAM_ROW + 1);
    const team = teamId ? teamsById.get(teamId) : undefined;
    const picked = Boolean(teamId) && entry.pick === teamId;

    if (index === 1) {
      context.fillStyle = COLORS.cardDivider;
      context.fillRect(x + 1, y + TEAM_ROW, COLUMN_WIDTH - 2, 1);
    }
    if (picked) {
      context.fillStyle = "#2f2f2f";
      context.fillRect(x + 1, rowY + (index === 0 ? 1 : 0), COLUMN_WIDTH - 2, TEAM_ROW - 1);
      context.fillStyle = COLORS.paper;
      context.fillRect(x + 1, rowY + (index === 0 ? 1 : 0), 3, TEAM_ROW - 1);
    }

    const faded = Boolean(entry.pick) && !picked;
    if (team) {
      context.globalAlpha = faded ? 0.4 : 1;
      drawLogo(context, fonts, logos.get(team.id) ?? null, team.short_name ?? team.name.slice(0, 3), 8, x + 8, rowY + 6, 18, 18);
      context.fillStyle = COLORS.paper;
      context.font = `${picked ? 700 : 500} 12px ${fonts.body}`;
      context.textAlign = "left";
      context.textBaseline = "middle";
      const result = picked && winner ? (winner === teamId ? "correct" : "wrong") : null;
      const [name] = wrapText(context, team.name, COLUMN_WIDTH - 34 - (result ? 22 : 8), 1);
      context.fillText(name, x + 32, rowY + TEAM_ROW / 2);
      context.globalAlpha = 1;
      if (result) {
        context.fillStyle = result === "correct" ? GREEN : RED;
        context.font = `700 13px ${fonts.body}`;
        context.textAlign = "center";
        context.fillText(result === "correct" ? "✓" : "✗", x + COLUMN_WIDTH - 12, rowY + TEAM_ROW / 2);
      }
    } else {
      context.fillStyle = "rgba(232, 236, 241, 0.3)";
      context.font = `italic 500 12px ${fonts.body}`;
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText("TBD", x + 32, rowY + TEAM_ROW / 2);
    }
  });
}
