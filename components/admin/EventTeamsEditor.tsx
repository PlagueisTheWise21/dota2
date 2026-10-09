"use client";

import { useMemo, useState } from "react";
import { Button, errorText, Message, Section, TextInput, type FormMessage } from "@/components/admin/ui";
import { TeamLogo } from "@/components/TeamLogo";
import { saveEventTeams, saveTeam, type AdminData, type AdminEvent, type AdminTeam } from "@/lib/admin";

/**
 * The teams in one event, in seed order (top = seed 1). Add existing teams
 * or create new ones, drag rows (or use the arrows) to reorder, remove with ×.
 * Nothing is saved until "Save teams".
 */
export function EventTeamsEditor({
  event,
  data,
  reload,
}: {
  event: AdminEvent;
  data: AdminData;
  reload: () => Promise<void>;
}) {
  const savedIds = useMemo(
    () =>
      data.eventTeams
        .filter((link) => link.event_id === event.id)
        .sort((a, b) => {
          const nameOf = (id: string) => data.teams.find((t) => t.id === id)?.name ?? "";
          return (a.seed ?? Infinity) - (b.seed ?? Infinity) || nameOf(a.team_id).localeCompare(nameOf(b.team_id));
        })
        .map((link) => link.team_id),
    [data, event.id],
  );
  const [ids, setIds] = useState<string[]>(savedIds);
  // When the saved list changes (a save or a sync), follow it unless there
  // are unsaved edits.
  const [base, setBase] = useState<string[]>(savedIds);
  if (base.join() !== savedIds.join()) {
    setBase(savedIds);
    if (ids.join() === base.join()) setIds(savedIds);
  }
  const [search, setSearch] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);

  const teamsById = useMemo(() => new Map(data.teams.map((team) => [team.id, team])), [data.teams]);
  const dirty = ids.join() !== savedIds.join();

  const query = search.trim().toLowerCase();
  const matches = query
    ? data.teams
        .filter(
          (team) =>
            !ids.includes(team.id) &&
            (team.name.toLowerCase().includes(query) || team.short_name?.toLowerCase().includes(query)),
        )
        .slice(0, 8)
    : [];
  const exactExists = data.teams.some((team) => team.name.toLowerCase() === query);

  function move(from: number, to: number) {
    if (to < 0 || to >= ids.length || from === to) return;
    setIds((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function add(team: AdminTeam) {
    setIds((current) => [...current, team.id]);
    setSearch("");
  }

  async function createAndAdd() {
    setBusy(true);
    setMessage(null);
    try {
      const team = await saveTeam(null, { name: search.trim(), short_name: null, logo_url: null });
      await reload();
      add(team);
      setMessage({ kind: "ok", text: `Created "${team.name}". Add its logo under Teams.` });
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await saveEventTeams(event.id, ids, savedIds);
      await reload();
      setMessage({ kind: "ok", text: "Teams saved." });
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={`Teams (${ids.length})`}>
      {event.liquipedia_page && (
        <p className="mb-3 text-xs text-paper/50">
          This event syncs from Liquipedia: the sync adds every team it lists, so teams removed here
          come back on the next sync if Liquipedia still has them.
        </p>
      )}

      <ol className="flex flex-col border border-paper/30">
        {ids.map((id, index) => {
          const team = teamsById.get(id);
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex cursor-grab items-center gap-3 px-3 py-1.5 not-last:border-b not-last:border-paper/15 ${
                dragIndex === index ? "opacity-40" : ""
              }`}
            >
              <span className="w-6 text-right font-display text-sm text-paper/50">{index + 1}</span>
              <span className="flex h-7 w-9 items-center justify-center">
                {team?.logo_url ? (
                  <TeamLogo team={team} fallbackStyle={{ fontSize: 9 }} />
                ) : (
                  <span className="text-[10px] text-paper/40">no logo</span>
                )}
              </span>
              <span className="flex-1 truncate">{team?.name ?? "(deleted team)"}</span>
              <span className="flex gap-1">
                <IconButton label="Move up" onClick={() => move(index, index - 1)} disabled={index === 0}>
                  ↑
                </IconButton>
                <IconButton label="Move down" onClick={() => move(index, index + 1)} disabled={index === ids.length - 1}>
                  ↓
                </IconButton>
                <IconButton label="Remove" onClick={() => setIds((current) => current.filter((x) => x !== id))}>
                  ×
                </IconButton>
              </span>
            </li>
          );
        })}
        {ids.length === 0 && <li className="px-3 py-2 text-sm text-paper/50">No teams yet.</li>}
      </ol>

      <div className="relative mt-3 max-w-md">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Add a team: type its name"
          aria-label="Add a team"
        />
        {query && (
          <ul className="absolute top-full right-0 left-0 z-20 border border-paper/40 bg-[#202020] shadow-lg">
            {matches.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => add(team)}
                  className="w-full cursor-pointer px-3 py-1.5 text-left text-sm hover:bg-[#2a2a2a]"
                >
                  {team.name}
                  {team.short_name && <span className="ml-2 text-paper/50">{team.short_name}</span>}
                </button>
              </li>
            ))}
            {!exactExists && (
              <li>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createAndAdd()}
                  className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-[#93c5fd] hover:bg-[#2a2a2a]"
                >
                  + Create new team &quot;{search.trim()}&quot;
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => void save()} disabled={busy || !dirty}>
          Save teams
        </Button>
        {dirty && (
          <Button onClick={() => setIds(savedIds)} disabled={busy}>
            Undo changes
          </Button>
        )}
        {dirty && <span className="text-sm text-[#facc15]">Unsaved changes</span>}
        <Message message={message} />
      </div>
    </Section>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="h-7 w-7 cursor-pointer border border-paper/40 text-sm hover:border-paper disabled:cursor-default disabled:opacity-25"
    >
      {children}
    </button>
  );
}
