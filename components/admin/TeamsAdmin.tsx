"use client";

import { useState } from "react";
import {
  Button,
  errorText,
  Field,
  Message,
  Section,
  Select,
  TextInput,
  type FormMessage,
} from "@/components/admin/ui";
import { FallbackImage } from "@/components/FallbackImage";
import { TeamLogo } from "@/components/TeamLogo";
import { logoFromFile, logoFromSavedUrl } from "@/lib/admin-images";
import {
  deleteTeam,
  isOwnImage,
  mergeTeams,
  removeOwnImage,
  saveTeam,
  uploadImage,
  type AdminData,
  type AdminTeam,
} from "@/lib/admin";

type Filter = "all" | "no-logo" | "slow-logo" | "unused";

const FILTERS: [Filter, string][] = [
  ["all", "All teams"],
  ["no-logo", "No logo"],
  ["slow-logo", "Logo not on this site yet"],
  ["unused", "Not in any event"],
];

export function TeamsAdmin({ data, reload }: { data: AdminData; reload: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState<string | "new" | null>(data.teams[0]?.id ?? "new");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const usedIds = new Set(data.eventTeams.map((link) => link.team_id));
  const query = search.trim().toLowerCase();
  const shown = data.teams.filter((team) => {
    if (query && !team.name.toLowerCase().includes(query) && !team.short_name?.toLowerCase().includes(query)) {
      return false;
    }
    if (filter === "no-logo") return !team.logo_url;
    if (filter === "slow-logo") return Boolean(team.logo_url) && !isOwnImage("team-logos", team.logo_url);
    if (filter === "unused") return !usedIds.has(team.id);
    return true;
  });
  const selected = data.teams.find((team) => team.id === selectedId);

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <aside className="flex flex-col gap-3">
        <Button onClick={() => setSelectedId("new")}>+ New team</Button>
        <FastCopyAll teams={data.teams} reload={reload} />
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teams" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Show">
          {FILTERS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <ul className="flex max-h-[70dvh] flex-col overflow-y-auto border border-accent/40 bg-panel">
          {shown.map((team) => (
            <li key={team.id} className="not-last:border-b not-last:border-accent/15">
              <button
                type="button"
                onClick={() => setSelectedId(team.id)}
                className={`flex w-full cursor-pointer items-center gap-3 px-3 py-1.5 text-left ${
                  team.id === selectedId ? "bg-card-hover shadow-[inset_3px_0_0_#1d9e75]" : "hover:bg-card-hover/60"
                }`}
              >
                <span className="flex h-7 w-9 shrink-0 items-center justify-center">
                  {team.logo_url ? (
                    <TeamLogo team={team} fallbackStyle={{ fontSize: 9 }} />
                  ) : (
                    <span className="text-[10px] text-[#f87171]">none</span>
                  )}
                </span>
                <span className="truncate">{team.name}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-paper/50">No teams match.</li>}
        </ul>
        <p className="text-xs text-paper/50">
          {shown.length} of {data.teams.length} teams
        </p>
      </aside>

      <div className="min-w-0">
        {selectedId === "new" && (
          <TeamEditor key="new" team={null} data={data} reload={reload} onSelect={setSelectedId} />
        )}
        {selected && (
          <TeamEditor key={selected.id} team={selected} data={data} reload={reload} onSelect={setSelectedId} />
        )}
      </div>
    </div>
  );
}

function TeamEditor({
  team,
  data,
  reload,
  onSelect,
}: {
  team: AdminTeam | null;
  data: AdminData;
  reload: () => Promise<void>;
  onSelect: (id: string | null) => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [shortName, setShortName] = useState(team?.short_name ?? "");
  const [logoUrl, setLogoUrl] = useState(team?.logo_url ?? "");
  const [mergeId, setMergeId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<FormMessage>(null);

  const events = team
    ? data.eventTeams
        .filter((link) => link.team_id === team.id)
        .map((link) => data.events.find((event) => event.id === link.event_id)?.name)
        .filter(Boolean)
    : [];
  const savedLogo = team?.logo_url ?? null;
  const logoIsOwn = isOwnImage("team-logos", savedLogo);

  async function run(label: string, action: () => Promise<string>) {
    setBusy(label);
    setMessage(null);
    try {
      setMessage({ kind: "ok", text: await action() });
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run("save", async () => {
      if (!name.trim()) throw new Error("The team needs a name.");
      const saved = await saveTeam(team?.id ?? null, {
        name: name.trim(),
        short_name: shortName.trim() || null,
        logo_url: logoUrl.trim() || null,
      });
      if (team && savedLogo !== saved.logo_url) await removeOwnImage("team-logos", savedLogo);
      await reload();
      if (!team) onSelect(saved.id);
      return team ? "Saved." : "Team created.";
    });

  /** Uploads a prepared logo and, for an existing team, saves it straight away. */
  async function applyLogo(image: Blob) {
    const url = await uploadImage("team-logos", name || "logo", image);
    setLogoUrl(url);
    if (!team) return "Logo uploaded; it is used when you create the team.";
    await saveTeam(team.id, { name: team.name, short_name: team.short_name, logo_url: url });
    await removeOwnImage("team-logos", savedLogo);
    await reload();
    return "Logo uploaded and saved.";
  }

  const remove = () =>
    run("delete", async () => {
      if (!team || !window.confirm(`Delete "${team.name}"? It is also removed from its events.`)) return "";
      await deleteTeam(team.id);
      await removeOwnImage("team-logos", savedLogo);
      onSelect(null);
      await reload();
      return "Deleted.";
    });

  const merge = () =>
    run("merge", async () => {
      const other = data.teams.find((t) => t.id === mergeId);
      if (!team || !other) return "";
      const ok = window.confirm(
        `Merge "${other.name}" into "${team.name}"? Its events, matches, group results and everyone's saved picks move to "${team.name}", then "${other.name}" is deleted.`,
      );
      if (!ok) return "";
      await mergeTeams(team.id, other.id);
      setMergeId("");
      await reload();
      return `Merged "${other.name}" into this team.`;
    });

  return (
    <Section title={team ? team.name : "New team"}>
      <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Short name" hint="Shown when the logo cannot load, e.g. XG">
            <TextInput value={shortName} onChange={(e) => setShortName(e.target.value)} maxLength={16} />
          </Field>
          <Field label="Logo URL" hint="Upload a file instead, or paste a link and save.">
            <TextInput value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
          </Field>
          {team && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-paper/50">Liquipedia</dt>
              <dd>{team.liquipedia_template ?? "not linked (the sync links it by name)"}</dd>
              <dt className="text-paper/50">Events</dt>
              <dd>{events.length ? events.join(", ") : "none"}</dd>
            </dl>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-display text-xs font-bold tracking-widest text-paper/80 uppercase">Logo</span>
          <div className="grid grid-cols-2 gap-1">
            {/* On the site's dark cards and on a light background, to spot see-through edges. */}
            {["bg-card", "bg-paper"].map((background) => (
              <div key={background} className={`flex aspect-square items-center justify-center p-2 ${background}`}>
                <FallbackImage
                  src={logoUrl || null}
                  retrySrc={logoUrl && logoUrl === savedLogo ? `/api/logo?url=${encodeURIComponent(logoUrl)}` : null}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  fallback={<span className="text-xs text-[#9ca3af]">No logo</span>}
                />
              </div>
            ))}
          </div>
          <label className="cursor-pointer border border-accent/40 bg-card px-3 py-1.5 text-center font-display text-sm font-bold tracking-widest uppercase hover:border-accent">
            {busy === "upload" ? "Uploading..." : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              disabled={busy !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void run("upload", async () => applyLogo(await logoFromFile(file)));
              }}
            />
          </label>
          {team && savedLogo && !logoIsOwn && (
            <Button
              disabled={busy !== null}
              onClick={() => void run("copy", async () => applyLogo(await logoFromSavedUrl(savedLogo)))}
              title="Trims the saved logo, shrinks it and stores it on this site so it loads fast"
            >
              {busy === "copy" ? "Copying..." : "Make fast copy"}
            </Button>
          )}
          <p className="text-xs text-paper/50">
            Uploads are trimmed and shrunk to 256px automatically.
            {team && savedLogo && !logoIsOwn && " This logo loads from another site; a fast copy loads quicker."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => void save()} disabled={busy !== null}>
          {team ? "Save" : "Create team"}
        </Button>
        {team && (
          <Button variant="danger" onClick={() => void remove()} disabled={busy !== null}>
            Delete team
          </Button>
        )}
        <Message message={message?.text ? message : null} />
      </div>

      {team && (
        <div className="mt-6 border-t border-accent/15 pt-4">
          <h3 className="font-display text-sm font-bold tracking-widest uppercase">Merge a duplicate</h3>
          <p className="mt-1 mb-2 text-xs text-paper/50">
            If the same team exists twice (e.g. the sync made a second copy), pick the copy here. Everything
            moves to this team and the copy is deleted.
          </p>
          <div className="flex flex-wrap gap-2">
            <Select value={mergeId} onChange={(e) => setMergeId(e.target.value)} className="max-w-xs">
              <option value="">Choose the duplicate...</option>
              {data.teams
                .filter((t) => t.id !== team.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.short_name ? ` (${t.short_name})` : ""}
                  </option>
                ))}
            </Select>
            <Button onClick={() => void merge()} disabled={!mergeId || busy !== null}>
              Merge into this team
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

/**
 * Converts every logo still stored on another site into a fast copy in the
 * team-logos bucket (trimmed 256px WebP), one team at a time.
 */
function FastCopyAll({ teams, reload }: { teams: AdminTeam[]; reload: () => Promise<void> }) {
  const slow = teams.filter((team) => team.logo_url && !isOwnImage("team-logos", team.logo_url));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<string[]>([]);

  if (slow.length === 0 && !progress) {
    return <p className="text-xs text-muted/70">Every logo loads fast.</p>;
  }

  async function run() {
    setFailed([]);
    setProgress({ done: 0, total: slow.length });
    const problems: string[] = [];
    for (const [index, team] of slow.entries()) {
      try {
        const image = await logoFromSavedUrl(team.logo_url!);
        const url = await uploadImage("team-logos", team.name, image);
        await saveTeam(team.id, { name: team.name, short_name: team.short_name, logo_url: url });
      } catch {
        problems.push(team.name);
      }
      setProgress({ done: index + 1, total: slow.length });
    }
    setFailed(problems);
    setProgress(null);
    await reload();
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={() => void run()} disabled={progress !== null} title="Trims each logo and stores a copy on this site">
        {progress ? `Copying ${progress.done}/${progress.total}...` : `Make fast copies (${slow.length})`}
      </Button>
      {failed.length > 0 && (
        <p className="text-xs text-[#f87171]">
          Couldn&apos;t copy: {failed.join(", ")}. Their sites may block downloads; upload those logos by hand.
        </p>
      )}
    </div>
  );
}
