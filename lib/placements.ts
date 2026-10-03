/**
 * Placement groups for predicting final standings, in the style Liquipedia
 * uses for Dota 2 events: 1, 2, 3, 4, then shared places 5-6, 7-8, 9-12,
 * 13-16, 17-24, 25-32 and so on (group sizes 1, 1, 1, 1, 2, 2, 4, 4, 8, 8...).
 *
 * Worked out from the number of teams for now. If an event ever finishes
 * differently, this could become per-event data.
 */

export type PlacementGroup = {
  /** "1", "5–6", "13–16" */
  label: string;
  /** Index of the group's first slot (0 = first place). */
  start: number;
  /** Number of teams that share this placement. */
  size: number;
};

export function placementGroups(teamCount: number): PlacementGroup[] {
  const groups: PlacementGroup[] = [];
  let start = 0;
  let pairSize = 2; // size of the next pair of shared groups after 4th

  while (start < teamCount) {
    let size: number;
    if (start < 4) {
      size = 1;
    } else {
      size = pairSize;
      // Two groups of each size, then double: 2, 2, 4, 4, 8, 8...
      const groupsAfterFourth = groups.length - 4;
      if (groupsAfterFourth % 2 === 1) pairSize *= 2;
    }
    size = Math.min(size, teamCount - start);

    const first = start + 1;
    const last = start + size;
    groups.push({
      label: size === 1 ? String(first) : `${first}–${last}`,
      start,
      size,
    });
    start += size;
  }

  return groups;
}
