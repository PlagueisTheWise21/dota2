"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/useAuth";

/**
 * Homepage top bar account control: "Sign in with Twitch", or the signed-in
 * person's avatar with a menu (Admin panel for admins, Sign out).
 */
export function HomeAccount() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  if (!auth.available) return null;
  if (!auth.ready) return <span className="h-9 w-32" aria-hidden="true" />;

  if (!auth.profile) {
    return (
      <button
        type="button"
        onClick={() => void auth.signIn()}
        className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#0F6E56] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#0F6E56]/30 transition-colors hover:bg-[#1D9E75]"
      >
        <TwitchIcon />
        <span className="hidden sm:inline">Sign in with Twitch</span>
        <span className="sm:hidden">Sign in</span>
      </button>
    );
  }

  const { profile } = auth;
  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${profile.display_name}`}
        className="flex cursor-pointer items-center rounded-lg p-0.5 ring-1 ring-[#1D9E75]/60 transition hover:ring-[#1D9E75]"
      >
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-md object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center">
            <TwitchIcon />
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-2 min-w-[12rem] overflow-hidden rounded-lg border border-[#1D9E75]/40 bg-[#0b2328]/95 text-sm shadow-xl backdrop-blur"
        >
          <p className="px-4 py-2.5 text-xs text-[#9FE1CB]/70">
            Signed in as <span className="font-semibold text-[#E1F5EE]">{profile.display_name}</span>
          </p>
          <Link href="/me" role="menuitem" className="block px-4 py-2 text-[#E1F5EE] hover:bg-[#0F6E56]/40">
            My picks
          </Link>
          {auth.isAdmin && (
            <Link href="/admin" role="menuitem" className="block px-4 py-2 text-[#E1F5EE] hover:bg-[#0F6E56]/40">
              Admin panel
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void auth.signOut();
            }}
            className="w-full cursor-pointer px-4 py-2 text-left text-[#E1F5EE] hover:bg-[#0F6E56]/40"
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
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M4.3 3 3 6.4v13.1h4.5V22h2.5l2.5-2.5h3.7l5-5V3H4.3Zm15.2 10.6-2.8 2.8h-4.5l-2.5 2.5v-2.5H5.9V4.7h13.6v8.9ZM16.7 7.6h-1.8v5h1.8v-5Zm-4.9 0H10v5h1.8v-5Z" />
    </svg>
  );
}
