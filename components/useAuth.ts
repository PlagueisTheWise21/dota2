"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** A row of `profiles` (filled from Twitch by the sign-in trigger). */
export type Profile = {
  id: string;
  display_name: string;
  twitch_login: string | null;
  avatar_url: string | null;
};

/**
 * The signed-in person (Supabase Auth with Twitch), or null.
 * `ready` is false until the session has been checked, so the page can avoid
 * flashing "Sign in" for someone who is signed in.
 */
export function useAuth() {
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loadedProfile, setLoadedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setChecked(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Load the profile through ensure_profile(), which also creates it if it
  // is missing (accounts from before profiles existed, or long-lived logins
  // that never went through the sign-in trigger).
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    supabase.rpc("ensure_profile").then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error("Could not load the profile:", error.message);
      setLoadedProfile((data as Profile | null) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Until the profile row arrives (or if it is missing), use the login's own data.
  const meta = user?.user_metadata ?? {};
  const profile: Profile | null = !user
    ? null
    : loadedProfile?.id === user.id
      ? loadedProfile
      : {
          id: user.id,
          display_name: meta.name ?? meta.full_name ?? meta.nickname ?? "Player",
          twitch_login: meta.preferred_username ?? meta.nickname ?? null,
          avatar_url: meta.avatar_url ?? meta.picture ?? null,
        };

  /** Goes to Twitch and comes back to this page signed in. */
  const signIn = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: { redirectTo: window.location.href.split("#")[0] },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  return {
    /** False until we know whether someone is signed in. */
    ready: supabase ? checked : true,
    /** False when Supabase is not configured. */
    available: Boolean(supabase),
    user,
    profile,
    signIn,
    signOut,
  };
}
