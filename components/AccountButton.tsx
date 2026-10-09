"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/components/useAuth";
import type { SaveStatus } from "@/components/useDebouncedSave";

type AccountButtonProps = {
  ready: boolean;
  profile: Profile | null;
  saveStatus: SaveStatus;
  /** Shows an "Admin panel" link in the menu. */
  isAdmin?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
};

const STATUS_TEXT: Partial<Record<SaveStatus, string>> = {
  pending: "Saving...",
  saving: "Saving...",
  saved: "Saved",
  error: "Couldn't save",
};

/**
 * "Sign in" with Twitch, or the signed-in person's picture and name with a
 * small menu to sign out. Shows whether picks have been saved.
 */
export function AccountButton({ ready, profile, saveStatus, isAdmin = false, onSignIn, onSignOut }: AccountButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the menu when clicking anywhere else.
  useEffect(() => {
    if (!menuOpen) return;
    function close(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const base =
    "shadow-offset flex h-full cursor-pointer items-center gap-2 border-2 border-paper/60 bg-panel px-[clamp(0.6rem,1.5vw,0.9rem)] py-[calc(clamp(0.2rem,0.9dvh,0.45rem)+1px)] font-display text-[clamp(0.85rem,min(2vw,2.8dvh),1.15rem)] font-bold tracking-widest whitespace-nowrap text-paper uppercase transition-colors hover:border-paper";

  if (!ready) {
    // Keeps the space while the session is checked, without flashing "Sign in".
    return <div className={`${base} pointer-events-none opacity-0`} aria-hidden="true">Sign in</div>;
  }

  if (!profile) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        title="Sign in with Twitch to save your tier lists and pick'ems"
        aria-label="Sign in with Twitch"
        className={base}
      >
        <TwitchIcon />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  const status = STATUS_TEXT[saveStatus];

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={`Signed in as ${profile.display_name}`}
        className={`${base} normal-case tracking-normal`}
      >
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            className="h-[1.4em] w-[1.4em] border border-paper/40 object-cover"
          />
        ) : (
          <TwitchIcon />
        )}
        <span className="hidden max-w-[10rem] truncate text-[0.85em] xl:inline">
          {profile.display_name}
        </span>
      </button>

      {status && !menuOpen && (
        <span
          role="status"
          className={`pointer-events-none absolute top-full left-0 mt-2 text-xs whitespace-nowrap ${
            saveStatus === "error" ? "text-[#ef4444]" : "text-paper/70"
          }`}
        >
          {status}
        </span>
      )}

      {menuOpen && (
        <div
          role="menu"
          className="shadow-offset absolute top-full left-0 z-40 mt-2 min-w-[12rem] border-2 border-paper/60 bg-panel p-1 text-sm"
        >
          <p className="px-3 py-2 text-xs text-paper/60">
            Signed in as <span className="font-semibold text-paper">{profile.display_name}</span>
          </p>
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              className="block w-full px-3 py-2 text-left font-display font-bold tracking-widest text-paper uppercase hover:bg-[#2a2a2a]"
            >
              Admin panel
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onSignOut();
            }}
            className="w-full cursor-pointer px-3 py-2 text-left font-display font-bold tracking-widest text-paper uppercase hover:bg-[#2a2a2a]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function TwitchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[1.1em] w-[1.1em]" fill="#a970ff">
      <path d="M4.3 3 3 6.4v13.1h4.5V22h2.5l2.5-2.5h3.7l5-5V3H4.3Zm15.2 10.6-2.8 2.8h-4.5l-2.5 2.5v-2.5H5.9V4.7h13.6v8.9ZM16.7 7.6h-1.8v5h1.8v-5Zm-4.9 0H10v5h1.8v-5Z" />
    </svg>
  );
}
