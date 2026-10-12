"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, errorText, Field, Message, Section, Select, TextInput, type FormMessage } from "@/components/admin/ui";
import {
  clearGroups,
  loadGroups,
  saveGroups,
  type AdminData,
  type AdminEvent,
} from "@/lib/admin";

const GROUP_LETTERS = "ABCDEFGH";

/**
 * Set an event's groups by hand (writes group_standings), so the group stage
 * pick'em opens before Liquipedia has the draw. Each of the event's teams
 * goes into a group; places that go through / continue are the same in
 * every group. A Liquipedia sync later replaces these.
 */
export function GroupsEditor({
  event,
  data,
  reload,
}: {
  event: AdminEvent;
  data: AdminData;
  reload: () => Promise<void>;
}) {
  const teams = useMemo(
    () =>
      data.eventTeams
        .filter((link) => link.event_id === event.id)
        .sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity))
        .map((link) => data.teams.find((team) => team.id === link.team_id))
        .filter((team): team is NonNullable<typeof team> => Boolean(team)),
    [data, event.id],
  );

  const [groupCount, setGroupCount] = useState(2);
  const [advance, setAdvance] = useState(2);
  const [continues, setContinues] = useState(0);
  /** team id -> group index */
  const [groupOf, setGroupOf] = useState<Record<string, number>>({});
  const [hasSaved, setHasSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);

  useEffect(() => {
    let cancelled = false;
    loadGroups(event.id)
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          setGroupCount(Math.max(1, saved.groups.length));
          setAdvance(saved.advance);
          setContinues(saved.continues);
          setGroupOf(Object.fromEntries(saved.groups.flatMap((ids, index) => ids.map((id) => [id, index]))));
        }
        setHasSaved(Boolean(saved));
        setLoading(false);
      })
      .catch((reason) => {
        if (cancelled) return;
        setMessage({ kind: "error", text: errorText(reason) });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  const groups = Array.from({ length: groupCount }, (_, index) =>
    teams.filter((team) => groupOf[team.id] === index),
  );
  const unassigned = teams.filter((team) => groupOf[team.id] === undefined || groupOf[team.id] >= groupCount);
  const smallest = Math.min(...groups.map((group) => group.length));

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await saveGroups(event, { groups: groups.map((group) => group.map((team) => team.id)), advance, continues });
      setHasSaved(true);
      await reload();
      setMessage({ kind: "ok", text: "Groups saved. The group stage pick'em is open." });
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!window.confirm("Remove this event's groups? The group stage pick'em closes until groups are set or synced again.")) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await clearGroups(event.id);
      setGroupOf({});
      setHasSaved(false);
      await reload();
      setMessage({ kind: "ok", text: "Groups removed." });
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Groups">
      <p className="mb-3 text-xs text-paper/60">
        Set the group draw here when it isn&apos;t on Liquipedia yet: players then order each group 1st to last
        in the pick&apos;em. A Liquipedia sync later replaces these with the real tables and results. Players&apos;
        picks are kept as long as the teams stay in the same groups.
        {event.liquipedia_page && " This event syncs from Liquipedia, so its groups may already be filled in below."}
      </p>

      {loading ? (
        <p className="text-sm text-paper/60">Loading…</p>
      ) : teams.length === 0 ? (
        <p className="text-sm text-paper/60">Add the event&apos;s teams first (Teams, above).</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Number of groups">
              <Select value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))}>
                {Array.from({ length: 8 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Go through per group" hint="Top places marked “advance”.">
              <TextInput
                type="number"
                min={0}
                max={16}
                value={advance}
                onChange={(e) => setAdvance(Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
            <Field label="Continue per group" hint="Next places marked “continues” (e.g. a last chance stage). Usually 0.">
              <TextInput
                type="number"
                min={0}
                max={16}
                value={continues}
                onChange={(e) => setContinues(Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(groupCount, 4)}, minmax(0, 1fr))` }}>
            {groups.map((group, index) => (
              <div key={index} className="rounded-lg border border-accent/30 bg-card/60 p-2">
                <p className="mb-1 font-display text-sm font-bold tracking-widest uppercase">
                  Group {GROUP_LETTERS[index]} <span className="font-sans text-xs font-normal text-paper/50">({group.length})</span>
                </p>
                <ul className="flex flex-col gap-0.5 text-sm">
                  {group.map((team) => (
                    <li key={team.id} className="truncate">{team.name}</li>
                  ))}
                  {group.length === 0 && <li className="text-xs text-paper/40">No teams yet</li>}
                </ul>
              </div>
            ))}
          </div>

          <ul className="mt-4 flex flex-col divide-y divide-white/10 rounded-lg border border-accent/20">
            {teams.map((team) => (
              <li key={team.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                <span className="truncate">{team.name}</span>
                <Select
                  aria-label={`Group for ${team.name}`}
                  className="max-w-[9rem]"
                  value={groupOf[team.id] !== undefined && groupOf[team.id] < groupCount ? String(groupOf[team.id]) : ""}
                  onChange={(e) =>
                    setGroupOf((current) => {
                      const next = { ...current };
                      if (e.target.value === "") delete next[team.id];
                      else next[team.id] = Number(e.target.value);
                      return next;
                    })
                  }
                >
                  <option value="">Not in a group</option>
                  {Array.from({ length: groupCount }, (_, index) => (
                    <option key={index} value={index}>
                      Group {GROUP_LETTERS[index]}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>

          {unassigned.length > 0 && (
            <p className="mt-2 text-xs text-[#facc15]">
              Not in a group: {unassigned.map((team) => team.name).join(", ")}. They won&apos;t appear in the group
              stage pick&apos;em.
            </p>
          )}
          {advance + continues > smallest && smallest > 0 && (
            <p className="mt-2 text-xs text-[#facc15]">
              More places go through/continue ({advance + continues}) than the smallest group has teams ({smallest}).
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => void save()} disabled={busy || groups.every((group) => group.length === 0)}>
              Save groups
            </Button>
            {hasSaved && (
              <Button variant="danger" onClick={() => void clear()} disabled={busy}>
                Clear groups
              </Button>
            )}
            <Message message={message} />
          </div>
        </>
      )}
    </Section>
  );
}
