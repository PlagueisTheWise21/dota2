"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { FallbackImage } from "@/components/FallbackImage";
import type { EventTeam } from "@/lib/events";
import { getTrimmedLogo, peekTrimmedLogo } from "@/lib/logo-trim";

/**
 * The logo with its empty margins trimmed (lib/logo-trim.ts).
 * undefined while trimming; null if there is no logo or trimming failed.
 */
function useTrimmedLogo(logoUrl: string | null): string | null | undefined {
  const [loaded, setLoaded] = useState<{ url: string; trimmed: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (!logoUrl || peekTrimmedLogo(logoUrl) !== undefined) return;
    let cancelled = false;
    getTrimmedLogo(logoUrl).then((trimmed) => {
      if (!cancelled) setLoaded({ url: logoUrl, trimmed });
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  if (!logoUrl) return null;
  const ready = peekTrimmedLogo(logoUrl);
  if (ready !== undefined) return ready;
  return loaded?.url === logoUrl ? loaded.trimmed : undefined;
}

type TeamLogoProps = {
  team: EventTeam;
  /** Style for the short-name placeholder (e.g. its font size). */
  fallbackStyle?: CSSProperties;
};

/**
 * A team's trimmed logo, filling its parent and keeping its shape.
 * Empty for a moment while the logo is trimmed. If trimming fails it shows
 * the original logo, then the short name if that fails too.
 */
export function TeamLogo({ team, fallbackStyle }: TeamLogoProps) {
  const trimmedLogo = useTrimmedLogo(team.logo_url);
  if (trimmedLogo === undefined) return null;

  return (
    <FallbackImage
      src={trimmedLogo ?? team.logo_url}
      retrySrc={team.logo_url}
      alt=""
      className="h-full w-full object-contain"
      fallback={
        <span
          className="font-display font-bold tracking-wide text-paper uppercase"
          style={fallbackStyle}
        >
          {team.short_name ?? team.name.slice(0, 3)}
        </span>
      }
    />
  );
}
