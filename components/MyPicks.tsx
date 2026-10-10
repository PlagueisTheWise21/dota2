"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { FallbackImage } from "@/components/FallbackImage";
import { SiteFooter } from "@/components/SiteFooter";
import { StatusTag } from "@/components/StatusTag";
import { useAuth } from "@/components/useAuth";
import { eventStatus } from "@/lib/event-status";
import { loadMyPicks, type MyEventPicks } from "@/lib/saved-picks";

/**
 * "My picks" (/me): every event where the signed-in person saved a tier list
 * or pick'ems, with links straight to each. Sign-in lives in the browser, so
 * this page loads in the browser too.
 */
export function MyPicks() {
  const auth = useAuth();
  const [loaded, setLoaded] = useState<{ userId: string; entries: MyEventPicks[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = auth.user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadMyPicks(userId)
      .then((entries) => {
        if (!cancelled) setLoaded({ userId, entries });
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const entries = loaded?.userId === userId ? loaded.entries : null;

  let content: ReactNode;
  if (!auth.ready) {
    content = <Note>Checking your account…</Note>;
  } else if (!auth.user) {
    content = (
      <Box>
        <p>Sign in with Twitch to see your saved tier lists and pick&apos;ems.</p>
        <button
          type="button"
          onClick={() => void auth.signIn()}
          className="cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
        >
          Sign in with Twitch
        </button>
      </Box>
    );
  } else if (error) {
    content = <Note>Your picks couldn&apos;t be loaded: {error}</Note>;
  } else if (!entries) {
    content = <Note>Loading your picks…</Note>;
  } else if (entries.length === 0) {
    content = (
      <Box>
        <p>You haven&apos;t saved any picks yet.</p>
        <Link href="/" className="rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-white hover:bg-accent">
          Find an event
        </Link>
      </Box>
    );
  } else {
    content = (
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={entry.event.id}>
            <EventPicks entry={entry} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="shadow-offset rounded-xl border border-accent/40 bg-panel px-4 py-2 font-display font-bold tracking-widest uppercase hover:border-accent"
        >
          Home
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-wide uppercase">My picks</h1>
        <span className="w-[5.5rem]" aria-hidden="true" />
      </header>
      {content}
      <SiteFooter />
    </main>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-accent/30 bg-panel px-6 py-4 text-center text-sm text-muted">{children}</p>;
}

function Box({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-accent/40 bg-panel px-6 py-8 text-center">
      {children}
    </div>
  );
}

function EventPicks({ entry }: { entry: MyEventPicks }) {
  const { event } = entry;
  const href = `/events/${event.id}`;
  const status = eventStatus(event.start_date, event.end_date);
  const hasPickems = entry.groupPicked !== null || entry.playoffsPicked !== null;
  const saved = [
    entry.tierList ? "Tier list" : null,
    entry.groupPicked !== null ? `Group stage · ${entry.groupPicked} picked` : null,
    entry.playoffsPicked !== null ? `Playoffs · ${entry.playoffsPicked} picked` : null,
  ].filter((label): label is string => label !== null);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-panel/95 p-3 sm:flex-row sm:items-center">
      <Link href={href} className="block aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-black/40 sm:w-44">
        <FallbackImage
          src={event.image_url}
          alt=""
          className="h-full w-full object-contain"
          fallback={
            <span className="flex h-full items-center justify-center p-2 text-center font-display font-bold uppercase">
              {event.name}
            </span>
          }
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag status={status} />
          <Link href={href} className="truncate font-display text-xl font-bold tracking-wide uppercase hover:text-white">
            {event.name}
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {saved.map((label) => (
            <span key={label} className="rounded-md bg-card px-2 py-0.5 text-xs text-muted">
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:flex-col">
        {entry.tierList && (
          <Link href={href} className="rounded-lg border border-accent/40 px-3 py-1.5 text-center text-sm font-semibold hover:border-accent">
            Tier list
          </Link>
        )}
        {hasPickems && (
          <Link
            href={`${href}?tab=pickems`}
            className="rounded-lg bg-accent-strong px-3 py-1.5 text-center text-sm font-semibold text-white hover:bg-accent"
          >
            Pick&apos;em
          </Link>
        )}
        <Link
          href={`${href}?tab=leaderboard`}
          className="rounded-lg border border-info px-3 py-1.5 text-center text-sm font-semibold text-[#b5d4f4] hover:bg-info/15"
        >
          Leaderboard
        </Link>
      </div>
    </article>
  );
}
