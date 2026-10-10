"use client";

import { TeamLogo } from "@/components/TeamLogo";
import type { EventTeam } from "@/lib/events";
import { POINTS, type Leaderboard as LeaderboardData } from "@/lib/leaderboard";

type LeaderboardProps = {
  leaderboard: LeaderboardData;
  teams: EventTeam[];
  /** Highlights this person's row. */
  currentUserId: string | null;
  groupDeadline: string;
  playoffsDeadline: string;
  /** Epoch ms from useNow; null until the page has loaded in the browser. */
  now: number | null;
};

const deadlineFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * The event's pick'em standings (lib/leaderboard.ts). Picks are private
 * until each deadline, so the table fills in when group picks lock and
 * again when playoff picks lock.
 */
export function Leaderboard({
  leaderboard,
  teams,
  currentUserId,
  groupDeadline,
  playoffsDeadline,
  now,
}: LeaderboardProps) {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const playoffsOpen = now !== null && now < Date.parse(playoffsDeadline);
  const { entries, scoring } = leaderboard;
  const mine = entries.find((entry) => entry.userId === currentUserId);

  return (
    <div className="flex max-h-full min-h-0 w-full max-w-[760px] flex-col self-start border-2 border-paper/60 bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-paper/30 px-4 py-2">
        <h2 className="font-display text-lg font-bold tracking-widest uppercase">Leaderboard</h2>
        <p className="text-xs text-paper/60">
          {mine
            ? `You: #${mine.rank} of ${entries.length} · ${mine.total} pts`
            : `${entries.length} ${entries.length === 1 ? "player" : "players"}`}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-paper/70">
          {now !== null && now >= Date.parse(groupDeadline)
            ? "Nobody saved pick'ems for this event before they locked."
            : `Picks stay private until they lock. The leaderboard appears when group stage picks lock (${deadlineFormat.format(new Date(groupDeadline))} UTC).`}
        </p>
      ) : (
        <div className="min-h-0 overflow-y-auto">
          <table className="w-full table-fixed text-sm">
            <thead className="sticky top-0 bg-panel font-display text-xs tracking-wide text-paper/60 uppercase sm:tracking-widest">
              <tr className="border-b border-paper/20">
                <th className="w-9 px-2 py-2 text-right sm:w-12 sm:px-3">#</th>
                <th className="px-2 py-2 text-left sm:px-3">Player</th>
                <th className="w-12 px-2 py-2 text-right sm:w-20">
                  <span className="sm:hidden">Grp</span>
                  <span className="hidden sm:inline">Group</span>
                </th>
                <th className="w-12 px-2 py-2 text-right sm:w-20">
                  <span className="sm:hidden">PO</span>
                  <span className="hidden sm:inline">Playoffs</span>
                </th>
                <th className="hidden w-24 px-2 py-2 text-center sm:table-cell">Champion</th>
                <th className="w-14 px-2 py-2 text-right sm:w-16 sm:px-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const champion = entry.champion ? teamsById.get(entry.champion) : undefined;
                const isMe = entry.userId === currentUserId;
                return (
                  <tr
                    key={entry.userId}
                    className={`border-b border-paper/10 ${isMe ? "bg-[#2a2a2a] shadow-[inset_3px_0_0_#e8ecf1]" : ""}`}
                  >
                    <td className="px-2 py-1.5 text-right font-display text-base font-bold text-paper/80 sm:px-3">
                      {entry.rank}
                    </td>
                    <td className="max-w-0 px-2 py-1.5 sm:px-3">
                      <span className="flex min-w-0 items-center gap-2">
                        {entry.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.avatarUrl} alt="" className="h-6 w-6 shrink-0 border border-paper/30 object-cover" />
                        ) : (
                          <span className="h-6 w-6 shrink-0 border border-paper/30 bg-[#202020]" />
                        )}
                        <span className="truncate">{entry.name}</span>
                        {isMe && <span className="text-xs text-paper/50">(you)</span>}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-paper/80">{entry.group ?? "–"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-paper/80">{entry.playoffs ?? "–"}</td>
                    <td className="hidden px-2 py-1.5 sm:table-cell">
                      <span className="mx-auto flex h-6 w-8 items-center justify-center" title={champion?.name}>
                        {champion ? <TeamLogo team={champion} fallbackStyle={{ fontSize: 9 }} /> : <span className="text-paper/30">–</span>}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-display text-base font-bold tabular-nums sm:px-3">{entry.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-paper/20 px-4 py-2 text-xs text-paper/50">
        {POINTS.group} pt per group stage pick marked ✓, {POINTS.playoffMatch} pt per playoff winner
        picked right.{" "}
        {!scoring && entries.length > 0 && "Points appear as results come in. "}
        {playoffsOpen &&
          `Playoff picks show here when they lock (${deadlineFormat.format(new Date(playoffsDeadline))} UTC).`}
      </p>
    </div>
  );
}
