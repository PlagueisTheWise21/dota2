"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { EventsAdmin } from "@/components/admin/EventsAdmin";
import { TeamsAdmin } from "@/components/admin/TeamsAdmin";
import { Button, errorText } from "@/components/admin/ui";
import { Panel } from "@/components/Panel";
import { useAuth } from "@/components/useAuth";
import { loadAdminData, type AdminData } from "@/lib/admin";

type Tab = "events" | "teams";

/**
 * The admin page: events (details, deadlines, banner, teams, Liquipedia
 * sync) and teams (names, logos, merging duplicates).
 * Only admins see it; the database refuses changes from anyone else anyway.
 */
export function AdminApp() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>("events");
  const [data, setData] = useState<AdminData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await loadAdminData());
      setLoadError(null);
    } catch (reason) {
      setLoadError(errorText(reason));
    }
  }, []);

  // Loads once the admin check passes.
  useEffect(() => {
    if (!auth.isAdmin) return;
    let cancelled = false;
    loadAdminData()
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch((reason) => {
        if (!cancelled) setLoadError(errorText(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [auth.isAdmin]);

  if (!auth.ready || !auth.adminChecked) {
    return <Centered>Checking your account...</Centered>;
  }

  if (!auth.user) {
    return (
      <Centered>
        <Panel className="flex flex-col items-center gap-4 px-10 py-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase">Admin</h1>
          <p>Sign in with your admin Twitch account.</p>
          <Button variant="primary" onClick={() => void auth.signIn()}>
            Sign in with Twitch
          </Button>
        </Panel>
      </Centered>
    );
  }

  if (!auth.isAdmin) {
    return (
      <Centered>
        <Panel className="px-10 py-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase">Page not found</h1>
          <p className="mt-2">That event or page does not exist.</p>
        </Panel>
        <Link href="/" className="text-sm text-paper/70 underline hover:text-paper">
          Back to events
        </Link>
      </Centered>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="shadow-offset rounded-xl border border-accent/40 bg-panel px-3 py-1.5 font-display font-bold tracking-widest uppercase hover:border-accent"
          >
            Home
          </Link>
          <Panel className="px-6 py-1.5">
            <h1 className="font-display text-2xl font-bold tracking-widest uppercase">Admin</h1>
          </Panel>
        </div>
        <nav className="flex" aria-label="Admin sections">
          {(["events", "teams"] as const).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              aria-pressed={tab === name}
              className={`cursor-pointer border border-accent/40 px-5 py-1.5 font-display font-bold tracking-widest uppercase not-first:border-l-0 ${
                tab === name ? "bg-card-hover shadow-[inset_0_-3px_0_#1d9e75]" : "bg-panel text-paper/70 hover:text-paper"
              }`}
            >
              {name}
            </button>
          ))}
        </nav>
        <p className="text-sm text-paper/60">Signed in as {auth.profile?.display_name}</p>
      </header>

      {loadError && <p className="text-sm text-[#f87171]">Could not load: {loadError}</p>}
      {!data ? (
        <p className="text-paper/60">Loading...</p>
      ) : tab === "events" ? (
        <EventsAdmin data={data} reload={reload} />
      ) : (
        <TeamsAdmin data={data} reload={reload} />
      )}
    </main>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-8 px-4 text-paper/80">
      {children}
    </main>
  );
}
