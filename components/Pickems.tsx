"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Panel } from "@/components/Panel";
import { SlotBoard, type Slots } from "@/components/SlotBoard";
import { TeamLogo } from "@/components/TeamLogo";
import type { EventDetails, EventTeam } from "@/lib/events";
import {
  grandFinal,
  groupIndexOfSlot,
  groupName,
  groupSegments,
  groupSlotCount,
  realWinner,
  resolveBracket,
  roundNames,
  roundRobinGroups,
  swissGroups,
  swissPickCorrect,
  type BracketMatch,
  type BracketPicks,
  type PickemData,
  type ResolvedMatch,
} from "@/lib/pickems";

export type PickemSection = "group" | "playoffs";

/** Your pick'em, kept by EventView so it survives switching tabs. Not saved yet. */
export type PickemState = {
  section: PickemSection;
  groupSlots: Slots;
  bracketPicks: BracketPicks;
};

export function initialPickemState(data: PickemData): PickemState {
  return {
    section: data.groupFormat !== null ? "group" : "playoffs",
    groupSlots: Array.from({ length: groupSlotCount(data) }, () => null),
    bracketPicks: {},
  };
}

export type StageLocks = { group: boolean; playoffs: boolean };
export type StageDeadlines = { group: string; playoffs: string };

type PickemsProps = {
  event: EventDetails;
  data: PickemData;
  state: PickemState;
  onChange: (state: PickemState) => void;
  /** Stages whose deadline has passed: shown, but no longer changeable. */
  locked: StageLocks;
  deadlines: StageDeadlines;
};

/**
 * Pick'em: a group stage section and a playoffs section (pick the winner of
 * every bracket match). The group stage depends on the format: Swiss
 * (CS-major style 3-0 / advance / 0-3) or round-robin (order each group);
 * other formats show a notice. Data comes from Liquipedia via `npm run sync`.
 */
export function Pickems({ event, data, state, onChange, locked, deadlines }: PickemsProps) {
  const teamsById = useMemo(
    () => new Map(event.teams.map((team) => [team.id, team])),
    [event.teams],
  );
  const hasGroup = data.groupFormat !== null;
  const hasPlayoffs = data.bracket.length > 0;

  if (!hasGroup && !hasPlayoffs) {
    return (
      <Panel className="max-w-xl self-start px-8 py-6 text-center">
        <h2 className="font-display text-2xl font-bold tracking-wide uppercase">Pick&apos;em</h2>
        <p className="mt-2 text-sm text-paper/80">
          Pick&apos;ems for {event.name} open once its groups and bracket are known.
        </p>
      </Panel>
    );
  }

  const sections: { id: PickemSection; label: string; enabled: boolean }[] = [
    { id: "group", label: "Group Stage", enabled: hasGroup },
    { id: "playoffs", label: "Playoffs", enabled: hasPlayoffs },
  ];

  return (
    <div className="flex h-full w-full flex-col items-center gap-[clamp(0.4rem,1.5dvh,0.9rem)]">
      <div role="tablist" aria-label="Pick'em sections" className="flex border border-paper/40 bg-panel">
        {sections.map((item) => {
          const selected = item.id === state.section;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={!item.enabled}
              onClick={() => onChange({ ...state, section: item.id })}
              className={`cursor-pointer px-4 py-1 font-display text-[clamp(0.75rem,1.8dvh,0.9rem)] font-bold tracking-widest uppercase transition-colors not-last:border-r not-last:border-paper/30 disabled:cursor-not-allowed disabled:opacity-30 ${
                selected
                  ? "bg-[#2a2a2a] text-paper shadow-[inset_0_-2px_0_0_#e8ecf1]"
                  : "text-paper/50 hover:text-paper"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 w-full flex-1 justify-center">
        {state.section === "group" && hasGroup ? (
          data.groupFormat === "swiss" ? (
            <GroupStage
              teams={data.groupTeamIds
                .map((id) => teamsById.get(id))
                .filter((team): team is EventTeam => Boolean(team))}
              data={data}
              slots={state.groupSlots}
              onChange={(groupSlots) => onChange({ ...state, groupSlots })}
              locked={locked.group}
              deadline={deadlines.group}
            />
          ) : data.groupFormat === "round_robin" ? (
            <RoundRobinStage
              data={data}
              teamsById={teamsById}
              slots={state.groupSlots}
              onChange={(groupSlots) => onChange({ ...state, groupSlots })}
              locked={locked.group}
              deadline={deadlines.group}
            />
          ) : (
            <Notice title="Group stage">
              This event&apos;s group stage format isn&apos;t supported for pick&apos;ems yet.
            </Notice>
          )
        ) : (
          <Bracket
            matches={data.bracket}
            teamsById={teamsById}
            picks={state.bracketPicks}
            onChange={(bracketPicks) => onChange({ ...state, bracketPicks })}
            locked={locked.playoffs}
            deadline={deadlines.playoffs}
          />
        )}
      </div>

      {event.liquipedia_page && (
        <p className="text-[0.65rem] text-paper/40">
          Match data from{" "}
          <a
            href={`https://liquipedia.net/dota2/${event.liquipedia_page}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-paper"
          >
            Liquipedia
          </a>{" "}
          (
          <a
            href="https://creativecommons.org/licenses/by-sa/3.0/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-paper"
          >
            CC BY-SA 3.0
          </a>
          )
        </p>
      )}
    </div>
  );
}

// --- Group stage --------------------------------------------------------------

function GroupStage({
  teams,
  data,
  slots,
  onChange,
  locked,
  deadline,
}: {
  teams: EventTeam[];
  data: PickemData;
  slots: Slots;
  onChange: (slots: Slots) => void;
  locked: boolean;
  deadline: string;
}) {
  const groups = useMemo(() => swissGroups(teams.length), [teams.length]);
  const records = useMemo(
    () => new Map((data.groupRecords ?? []).map((record) => [record.teamId, record])),
    [data.groupRecords],
  );

  const picked = slots.filter(Boolean).length;
  const correct = data.groupRecords
    ? slots.filter((teamId, index) => {
        const record = teamId ? records.get(teamId) : undefined;
        return record ? swissPickCorrect(groupIndexOfSlot(groups, index), record) : false;
      }).length
    : 0;

  return (
    <SlotBoard
      teams={teams}
      groups={groups}
      slots={slots}
      onChange={onChange}
      slotsTitle={
        (data.groupRecords
          ? `Your picks · ${correct}/${picked} correct`
          : `Your picks · ${picked}/${slots.length}`) + (locked ? " · locked" : "")
      }
      resultFor={
        data.groupRecords
          ? (index, teamId) => {
              const record = records.get(teamId);
              if (!record) return null;
              return swissPickCorrect(groupIndexOfSlot(groups, index), record) ? "correct" : "wrong";
            }
          : undefined
      }
      readOnly={locked}
      footer={
        locked
          ? `Picks locked ${formatDeadline(deadline)}`
          : `Drag teams into the picks on the left · locks ${formatDeadline(deadline)}`
      }
    />
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="max-w-xl self-start px-8 py-6 text-center">
      <h2 className="font-display text-2xl font-bold tracking-wide uppercase">{title}</h2>
      <p className="mt-2 text-sm text-paper/80">{children}</p>
    </Panel>
  );
}

/**
 * Round-robin group stage: one board per group (switch with Group A / B...),
 * order its teams 1st to last. Marked right or wrong against the final group
 * tables once every group match has been played.
 */
function RoundRobinStage({
  data,
  teamsById,
  slots,
  onChange,
  locked,
  deadline,
}: {
  data: PickemData;
  teamsById: Map<string, EventTeam>;
  slots: Slots;
  onChange: (slots: Slots) => void;
  locked: boolean;
  deadline: string;
}) {
  const [selected, setSelected] = useState(0);

  if (data.groups.length === 0) {
    return (
      <Notice title="Groups not drawn yet">
        The groups haven&apos;t been drawn yet. They&apos;ll appear here once Liquipedia has the
        draw; group picks lock {formatDeadline(deadline)}.
      </Notice>
    );
  }

  const segments = groupSegments(data);
  const current = Math.min(selected, data.groups.length - 1);
  const group = data.groups[current];
  const segment = segments[current];
  const teams = group.teamIds
    .map((id) => teamsById.get(id))
    .filter((team): team is EventTeam => Boolean(team));
  const groupSlots = slots.slice(segment.offset, segment.offset + segment.size);
  const placements = data.groupPlacements;
  const picked = groupSlots.filter(Boolean).length;
  const correct = placements
    ? groupSlots.filter((id, index) => id && placements[id] === index + 1).length
    : 0;

  function change(next: Slots) {
    const all = [...slots];
    all.splice(segment.offset, segment.size, ...next);
    onChange(all);
  }

  return (
    <div className="flex h-full w-full flex-col items-center gap-[clamp(0.3rem,1dvh,0.6rem)]">
      <div role="tablist" aria-label="Groups" className="flex border border-paper/30 bg-panel">
        {data.groups.map((item, index) => {
          const itemSegment = segments[index];
          const filled = slots
            .slice(itemSegment.offset, itemSegment.offset + itemSegment.size)
            .filter(Boolean).length;
          return (
            <button
              key={item.index}
              type="button"
              role="tab"
              aria-selected={index === current}
              onClick={() => setSelected(index)}
              className={`cursor-pointer px-3 py-0.5 font-display text-[clamp(0.7rem,1.6dvh,0.8rem)] font-bold tracking-widest uppercase transition-colors not-last:border-r not-last:border-paper/30 ${
                index === current ? "bg-[#2a2a2a] text-paper" : "text-paper/50 hover:text-paper"
              }`}
            >
              {groupName(item.index)}
              <span className="ml-1.5 font-sans text-[0.65rem] font-medium tracking-normal opacity-60">
                {filled}/{itemSegment.size}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 w-full flex-1 justify-center">
        <SlotBoard
          key={group.index}
          teams={teams}
          groups={roundRobinGroups(teams.length, group.advance)}
          slots={groupSlots}
          onChange={change}
          slotsTitle={
            `${groupName(group.index)} · ` +
            (placements ? `${correct}/${picked} correct` : `${picked}/${segment.size}`) +
            (locked ? " · locked" : "")
          }
          resultFor={
            placements
              ? (index, teamId) =>
                  placements[teamId] === undefined
                    ? null
                    : placements[teamId] === index + 1
                      ? "correct"
                      : "wrong"
              : undefined
          }
          readOnly={locked}
          footer={
            locked
              ? `Picks locked ${formatDeadline(deadline)}`
              : `Drag the teams into the order they'll finish · locks ${formatDeadline(deadline)}`
          }
        />
      </div>
    </div>
  );
}

// --- Playoffs -----------------------------------------------------------------

function Bracket({
  matches,
  teamsById,
  picks,
  onChange,
  locked,
  deadline,
}: {
  matches: BracketMatch[];
  teamsById: Map<string, EventTeam>;
  picks: BracketPicks;
  onChange: (picks: BracketPicks) => void;
  locked: boolean;
  deadline: string;
}) {
  const { resolved } = useMemo(() => resolveBracket(matches, picks), [matches, picks]);
  const names = useMemo(() => roundNames(matches), [matches]);
  const rounds = useMemo(() => [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b), [matches]);
  const final = useMemo(() => grandFinal(matches), [matches]);

  function pick(matchId: string, teamId: string) {
    if (locked) return;
    const next = { ...picks };
    if (next[matchId] === teamId) delete next[matchId];
    else next[matchId] = teamId;
    // Drop later picks that this change made impossible.
    onChange(resolveBracket(matches, next).picks);
  }

  const champion = final ? resolved.get(final.id)?.pick : null;
  const finishedPicked = [...resolved.values()].filter((r) => r.pick && realWinner(r.match));
  const correct = finishedPicked.filter((r) => r.pick === realWinner(r.match)).length;
  const pickedCount = [...resolved.values()].filter((r) => r.pick).length;
  const noTeamsYet = [...resolved.values()].every((r) => !r.teams[0] && !r.teams[1]);

  const sectionRow = (section: "upper" | "lower") => {
    const hasAny = matches.some((m) => m.section === section);
    if (!hasAny) return null;
    return (
      <>
        {rounds.map((round) => (
          <p
            key={`${section}-head-${round}`}
            className="truncate text-center font-display text-[0.7rem] font-bold tracking-widest text-paper/60 uppercase"
          >
            {names.get(`${section}:${round}`) ?? ""}
          </p>
        ))}
        {rounds.map((round) => (
          <div key={`${section}-${round}`} className="flex flex-col justify-around gap-2">
            {matches
              .filter((m) => m.section === section && m.round === round)
              .sort((a, b) => a.number - b.number)
              .map((m) => (
                <MatchCard
                  key={m.id}
                  entry={resolved.get(m.id)!}
                  teamsById={teamsById}
                  onPick={(teamId) => pick(m.id, teamId)}
                  readOnly={locked}
                />
              ))}
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="flex h-full w-full flex-col items-center gap-2 overflow-auto">
      <div className="flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 text-xs text-paper/70">
        <span>
          {locked
            ? `Picks locked ${formatDeadline(deadline)}`
            : noTeamsYet
              ? `Playoff picks open once the group stage decides the teams · locks ${formatDeadline(deadline)}`
              : `Click a team to pick the winner of each match · locks ${formatDeadline(deadline)}`}
        </span>
        <span>
          {pickedCount}/{matches.length} picked
          {finishedPicked.length > 0 && ` · ${correct}/${finishedPicked.length} correct`}
        </span>
      </div>

      <div
        className="grid w-full min-w-[640px] max-w-5xl gap-x-3 gap-y-1.5"
        style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}
      >
        {sectionRow("upper")}
        <div style={{ gridColumn: `1 / -1` }} className="h-1" />
        {sectionRow("lower")}
      </div>

      <div className="shadow-offset mt-1 flex items-center gap-3 border-2 border-paper/60 bg-panel px-4 py-2">
        <span className="font-display text-xs font-bold tracking-widest text-paper/60 uppercase">
          Your champion
        </span>
        {champion && teamsById.get(champion) ? (
          <span className="flex items-center gap-2 font-display text-lg font-bold tracking-wide uppercase">
            <span className="flex h-7 w-7 items-center justify-center">
              <TeamLogo team={teamsById.get(champion)!} fallbackStyle={{ fontSize: "0.6rem" }} />
            </span>
            {teamsById.get(champion)!.name}
          </span>
        ) : (
          <span className="text-sm text-paper/40">Pick the grand final</span>
        )}
      </div>
    </div>
  );
}

function MatchCard({
  entry,
  teamsById,
  onPick,
  readOnly,
}: {
  entry: ResolvedMatch;
  teamsById: Map<string, EventTeam>;
  onPick: (teamId: string) => void;
  readOnly: boolean;
}) {
  const winner = realWinner(entry.match);
  return (
    <div className="border border-paper/60 bg-[#202020] shadow-[2px_2px_0_0_#000]">
      {entry.teams.map((teamId, index) => {
        const team = teamId ? teamsById.get(teamId) : undefined;
        const picked = Boolean(teamId) && entry.pick === teamId;
        const result = picked && winner ? (winner === teamId ? "correct" : "wrong") : null;
        return (
          <button
            key={index}
            type="button"
            disabled={!team || readOnly}
            onClick={() => team && onPick(team.id)}
            title={team ? (readOnly ? team.name : `Pick ${team.name}`) : "Decided by an earlier pick"}
            className={`flex h-[clamp(1.6rem,3.6dvh,2rem)] w-full cursor-pointer items-center gap-2 px-2 text-left text-[clamp(0.7rem,1.6dvh,0.8rem)] transition-colors disabled:cursor-default ${
              index === 1 ? "border-t border-paper/30" : ""
            } ${
              picked
                ? "bg-[#2f2f2f] font-bold text-paper shadow-[inset_3px_0_0_0_#e8ecf1]"
                : entry.pick
                  ? "text-paper/40 hover:text-paper"
                  : "text-paper/85 hover:bg-[#2a2a2a]"
            }`}
          >
            <span className="flex h-[70%] aspect-square shrink-0 items-center justify-center">
              {team && <TeamLogo team={team} fallbackStyle={{ fontSize: "0.5rem" }} />}
            </span>
            <span className={`min-w-0 flex-1 truncate ${team ? "" : "italic text-paper/30"}`}>
              {team ? team.name : "TBD"}
            </span>
            {result && (
              <span
                aria-label={result}
                className={`shrink-0 font-bold ${result === "correct" ? "text-[#22c55e]" : "text-[#ef4444]"}`}
              >
                {result === "correct" ? "✓" : "✗"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const deadlineFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** "22 Oct, 08:00 UTC" */
function formatDeadline(iso: string): string {
  return `${deadlineFormat.format(new Date(iso))} UTC`;
}
