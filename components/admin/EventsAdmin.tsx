"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventTeamsEditor } from "@/components/admin/EventTeamsEditor";
import { SyncPanel } from "@/components/admin/SyncPanel";
import {
  Button,
  errorText,
  Field,
  formatUtc,
  fromUtcInput,
  Message,
  Section,
  Select,
  TextInput,
  toUtcInput,
  type FormMessage,
} from "@/components/admin/ui";
import { FallbackImage } from "@/components/FallbackImage";
import { useNow } from "@/components/useNow";
import { bannerFromFile } from "@/lib/admin-images";
import {
  deleteEvent,
  loadEventSyncInfo,
  removeOwnImage,
  saveEvent,
  slugify,
  updateEvent,
  uploadImage,
  type AdminData,
  type AdminEvent,
  type EventInput,
  type EventSyncInfo,
} from "@/lib/admin";

type Selection = { kind: "event"; id: string } | { kind: "new" } | { kind: "import" } | null;

const STATUSES = ["upcoming", "live", "finished"];
const GROUP_FORMATS: [string, string][] = [
  ["", "None / not set"],
  ["swiss", "Swiss"],
  ["round_robin", "Round-robin groups"],
  ["gsl", "GSL groups (pick'em not supported)"],
  ["other", "Other (pick'em not supported)"],
];

export function EventsAdmin({ data, reload }: { data: AdminData; reload: () => Promise<void> }) {
  const [selection, setSelection] = useState<Selection>(
    data.events[0] ? { kind: "event", id: data.events[0].id } : { kind: "new" },
  );
  const selected = selection?.kind === "event" ? data.events.find((e) => e.id === selection.id) : undefined;

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <aside className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setSelection({ kind: "new" })}>
            + New event
          </Button>
          <Button className="flex-1" onClick={() => setSelection({ kind: "import" })}>
            Import
          </Button>
        </div>
        <ul className="flex flex-col border-2 border-paper/60 bg-panel">
          {data.events.map((event) => {
            const teamCount = data.eventTeams.filter((link) => link.event_id === event.id).length;
            const active = selection?.kind === "event" && selection.id === event.id;
            return (
              <li key={event.id} className="not-last:border-b not-last:border-paper/20">
                <button
                  type="button"
                  onClick={() => setSelection({ kind: "event", id: event.id })}
                  className={`w-full cursor-pointer px-3 py-2 text-left ${
                    active ? "bg-[#2a2a2a] shadow-[inset_3px_0_0_#e8ecf1]" : "hover:bg-[#1f1f1f]"
                  }`}
                >
                  <span className="block truncate font-semibold">{event.name}</span>
                  <span className="text-xs text-paper/50">
                    {event.start_date.slice(0, 10)} · {event.status} · {teamCount} teams
                  </span>
                </button>
              </li>
            );
          })}
          {data.events.length === 0 && <li className="px-3 py-2 text-sm text-paper/50">No events yet.</li>}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-col gap-5">
        {selection?.kind === "new" && (
          <EventDetails
            key="new"
            event={null}
            reload={reload}
            onSaved={(id) => setSelection({ kind: "event", id })}
          />
        )}
        {selection?.kind === "import" && (
          <Section title="Import from Liquipedia">
            <p className="mb-3 text-sm text-paper/70">
              Creates the event with its teams, matches and groups from a Liquipedia page. Teams
              that are new to the site are created without logos; add them under Teams.
            </p>
            <SyncPanel
              event={null}
              reload={reload}
              onImported={(id) => setSelection({ kind: "event", id })}
            />
          </Section>
        )}
        {selected && (
          <div key={selected.id} className="flex flex-col gap-5">
            <EventDetails
              event={selected}
              reload={reload}
              onSaved={() => undefined}
              onDeleted={() => setSelection(null)}
            />
            <Deadlines event={selected} reload={reload} />
            <EventTeamsEditor event={selected} data={data} reload={reload} />
            <Section title="Liquipedia sync">
              <SyncPanel event={selected} reload={reload} />
            </Section>
          </div>
        )}
        {!selection && <p className="text-paper/60">Pick an event on the left.</p>}
      </div>
    </div>
  );
}

// --- Details ------------------------------------------------------------------

/** Keeps the original time when only the date matters and it did not change. */
function dateValue(original: string | null, input: string, time: string): string {
  if (original && original.slice(0, 10) === input) return original;
  return `${input}T${time}Z`;
}

function EventDetails({
  event,
  reload,
  onSaved,
  onDeleted,
}: {
  event: AdminEvent | null;
  reload: () => Promise<void>;
  onSaved: (id: string) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(event?.name ?? "");
  const [startDate, setStartDate] = useState(event?.start_date.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(event?.end_date.slice(0, 10) ?? "");
  const [status, setStatus] = useState(event?.status ?? "upcoming");
  const [liquipediaPage, setLiquipediaPage] = useState(event?.liquipedia_page ?? "");
  const [groupFormat, setGroupFormat] = useState(event?.group_format ?? "");
  const [imageUrl, setImageUrl] = useState(event?.image_url ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);

  async function save() {
    if (!name.trim()) return setMessage({ kind: "error", text: "The event needs a name." });
    if (!startDate || !endDate) return setMessage({ kind: "error", text: "Fill in both dates." });
    if (endDate < startDate) return setMessage({ kind: "error", text: "The end date is before the start date." });
    setBusy(true);
    setMessage(null);
    try {
      const input: EventInput = {
        name: name.trim(),
        slug: event?.slug ?? slugify(name),
        start_date: dateValue(event?.start_date ?? null, startDate, "00:00:00"),
        end_date: dateValue(event?.end_date ?? null, endDate, "23:59:59"),
        // A new event's group picks lock when it starts; change it under Deadlines.
        prediction_deadline: event?.prediction_deadline ?? `${startDate}T00:00:00Z`,
        playoff_deadline: event?.playoff_deadline ?? null,
        status,
        image_url: imageUrl.trim() || null,
        liquipedia_page: liquipediaPage.trim().replace(/ /g, "_") || null,
        group_format: groupFormat || null,
      };
      const saved = await saveEvent(event?.id ?? null, input);
      if (event && event.image_url !== saved.image_url) await removeOwnImage("event-banners", event.image_url);
      await reload();
      setMessage({ kind: "ok", text: event ? "Saved." : "Event created." });
      onSaved(saved.id);
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
    } finally {
      setBusy(false);
    }
  }

  async function uploadBanner(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const url = await uploadImage("event-banners", name || "banner", await bannerFromFile(file));
      setImageUrl(url);
      if (event) {
        // Existing events get the new banner straight away.
        await updateEvent(event.id, { image_url: url });
        await removeOwnImage("event-banners", event.image_url);
        await reload();
        setMessage({ kind: "ok", text: "Banner uploaded." });
      } else {
        setMessage({ kind: "ok", text: "Banner uploaded; it is used when you create the event." });
      }
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!event) return;
    const typed = window.prompt(
      `Delete "${event.name}"? Its matches, groups and everyone's saved tier lists and pick'ems for it are deleted too. Type the event name to confirm.`,
    );
    if (typed?.trim() !== event.name) return;
    setBusy(true);
    try {
      await deleteEvent(event.id);
      await removeOwnImage("event-banners", event.image_url);
      onDeleted?.();
      await reload();
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
      setBusy(false);
    }
  }

  return (
    <Section
      title={event ? "Event details" : "New event"}
      actions={
        event && (
          <Link href={`/events/${event.id}`} className="text-sm text-paper/70 underline hover:text-paper">
            Open event page
          </Link>
        )
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </Field>
          </div>
          <Field label="Start date">
            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End date">
            <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {[...new Set([...STATUSES, status])].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Group stage format" hint="The sync sets this from Liquipedia.">
            <Select value={groupFormat} onChange={(e) => setGroupFormat(e.target.value)}>
              {GROUP_FORMATS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Liquipedia page" hint="The part after liquipedia.net/dota2/, e.g. PGL/Wallachia/9">
              <TextInput
                value={liquipediaPage}
                onChange={(e) => setLiquipediaPage(e.target.value)}
                placeholder="PARI_Universe/1"
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Field label="Banner">
            <div className="aspect-video w-full border border-paper/40 bg-[#202020]">
              <FallbackImage
                src={imageUrl || null}
                alt=""
                className="h-full w-full object-contain"
                fallback={<span className="flex h-full items-center justify-center text-xs text-paper/40">No banner</span>}
              />
            </div>
          </Field>
          <label className="cursor-pointer border-2 border-paper/60 bg-[#202020] px-3 py-1.5 text-center font-display text-sm font-bold tracking-widest uppercase hover:border-paper">
            Upload banner
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadBanner(file);
              }}
            />
          </label>
          <TextInput
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="or paste an image URL"
            aria-label="Banner URL"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => void save()} disabled={busy}>
          {event ? "Save" : "Create event"}
        </Button>
        {event && (
          <Button variant="danger" onClick={() => void remove()} disabled={busy}>
            Delete event
          </Button>
        )}
        <Message message={message} />
      </div>
    </Section>
  );
}

// --- Deadlines ------------------------------------------------------------------

function Deadlines({ event, reload }: { event: AdminEvent; reload: () => Promise<void> }) {
  const now = useNow();
  const [group, setGroup] = useState(toUtcInput(event.prediction_deadline));
  const [playoffs, setPlayoffs] = useState(toUtcInput(event.playoff_deadline));
  const [info, setInfo] = useState<EventSyncInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);

  useEffect(() => {
    let cancelled = false;
    loadEventSyncInfo(event.id)
      .then((result) => !cancelled && setInfo(result))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  const autoPlayoffs = info?.firstPlayoffMatch ?? event.end_date;
  const effectivePlayoffs = event.playoff_deadline ?? autoPlayoffs;

  async function apply(changes: Partial<EventInput>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await updateEvent(event.id, changes);
      setGroup(toUtcInput(saved.prediction_deadline));
      setPlayoffs(toUtcInput(saved.playoff_deadline));
      await reload();
      setMessage({ kind: "ok", text: done });
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
    } finally {
      setBusy(false);
    }
  }

  const state = (iso: string) =>
    now === null ? "" : new Date(iso).getTime() <= now ? "Locked" : "Open";
  const nowIso = () => new Date().toISOString();

  return (
    <Section title="Pick'em deadlines (UTC)">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Field
            label="Group stage picks lock"
            hint={`${state(event.prediction_deadline)} · now ${formatUtc(event.prediction_deadline)}`}
          >
            <TextInput type="datetime-local" value={group} onChange={(e) => setGroup(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !group}
              onClick={() => void apply({ prediction_deadline: fromUtcInput(group)! }, "Group deadline saved.")}
            >
              Save
            </Button>
            <Button
              disabled={busy}
              onClick={() => void apply({ prediction_deadline: nowIso() }, "Group stage picks are locked.")}
            >
              Lock now
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Field
            label="Playoff picks lock"
            hint={
              <>
                {state(effectivePlayoffs)} · now {formatUtc(effectivePlayoffs)}
                {event.playoff_deadline ? " (set by hand)" : " (automatic)"}. Automatic = first playoff
                match ({formatUtc(info?.firstPlayoffMatch ?? null)}), or the event&apos;s end.
              </>
            }
          >
            <TextInput type="datetime-local" value={playoffs} onChange={(e) => setPlayoffs(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !playoffs}
              onClick={() => void apply({ playoff_deadline: fromUtcInput(playoffs) }, "Playoff deadline saved.")}
            >
              Save
            </Button>
            <Button
              disabled={busy}
              onClick={() => void apply({ playoff_deadline: nowIso() }, "Playoff picks are locked.")}
            >
              Lock now
            </Button>
            <Button
              disabled={busy || !event.playoff_deadline}
              onClick={() => void apply({ playoff_deadline: null }, "Playoff deadline is automatic again.")}
            >
              Use automatic
            </Button>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-paper/50">
        To reopen picks, set a later time and save. The database enforces these times too.
      </p>
      <div className="mt-2">
        <Message message={message} />
      </div>
    </Section>
  );
}
