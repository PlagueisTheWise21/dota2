"use client";

import Link from "next/link";
import { useState } from "react";
import { DEFAULT_LAYOUT, type OverlayLayout, type OverlayTeam } from "@/lib/overlay-teams";

const SLIDERS: { key: keyof OverlayLayout; label: string; min: number; max: number }[] = [
  { key: "y", label: "Height from top", min: 0, max: 200 },
  { key: "step", label: "Space between portraits", min: 40, max: 100 },
  { key: "radiantX", label: "Radiant carry (centre)", min: 400, max: 900 },
  { key: "direX", label: "Dire first hero (centre)", min: 960, max: 1500 },
  { key: "size", label: "Text size", min: 10, max: 28 },
];

const POSITIONS = ["Carry", "Mid", "Offlane", "Soft support", "Hard support"];

/**
 * The overlay page: choose Radiant and Dire, tune the positions, and get a
 * transparent 1920x1080 PNG (app/overlay/image/route.tsx) to right-click →
 * save, or to load straight into OBS by its address.
 */
export function OverlayBuilder({
  teams,
  error,
  tournament,
}: {
  teams: OverlayTeam[];
  error: string | null;
  tournament: string;
}) {
  const [radiant, setRadiant] = useState("");
  const [dire, setDire] = useState("");
  const [layout, setLayout] = useState<OverlayLayout>(DEFAULT_LAYOUT);
  const [copied, setCopied] = useState(false);

  const query = new URLSearchParams({
    page: tournament,
    radiant,
    dire,
    ...Object.fromEntries(Object.entries(layout).map(([key, value]) => [key, String(value)])),
  });
  const imagePath = `/overlay/image?${query.toString()}`;
  const ready = radiant && dire;
  const radiantTeam = teams.find((team) => team.name === radiant);
  const direTeam = teams.find((team) => team.name === dire);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(new URL(imagePath, window.location.origin).toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const select =
    "w-full rounded-lg border border-accent/40 bg-card px-3 py-2 text-sm text-paper focus:border-accent focus:outline-none";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="shadow-offset rounded-xl border border-accent/40 bg-panel px-4 py-2 font-display font-bold tracking-widest uppercase hover:border-accent"
        >
          Home
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-wide uppercase sm:text-3xl">Stream overlay</h1>
        <span className="w-[5.5rem]" aria-hidden="true" />
      </header>

      <section className="flex flex-col gap-4 rounded-xl border border-accent/30 bg-panel/95 p-4">
        <p className="text-sm text-muted">
          Teams and players from Liquipedia ({tournament.replace(/_/g, " ")}), each side ordered carry, mid, offlane,
          soft support, hard support.
        </p>
        {error && <p className="text-sm text-[#f87171]">Rosters couldn&apos;t be loaded: {error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Radiant", radiant, setRadiant, radiantTeam, "#4ade80"],
              ["Dire", dire, setDire, direTeam, "#f87171"],
            ] as const
          ).map(([side, value, setValue, team, colour]) => (
            <div key={side} className="flex flex-col gap-2">
              <label className="font-display text-sm font-bold tracking-widest uppercase" style={{ color: colour }}>
                {side}
                <select className={`${select} mt-1`} value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">Choose a team…</option>
                  {teams.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              {team && (
                <ol className="flex flex-col gap-0.5 text-sm">
                  {team.players.map((player, index) => (
                    <li key={player} className="flex gap-2">
                      <span className="w-28 text-muted/60">{POSITIONS[index]}</span>
                      <span className="font-semibold">{player}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-panel/95 p-4">
        <h2 className="font-display text-lg font-bold tracking-widest uppercase">Overlay</h2>
        {!ready ? (
          <p className="text-sm text-muted">Choose both teams to make the overlay.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Right-click the image → <strong>Save image as…</strong> and add it to OBS as an image source over the
              game (1920×1080, transparent background). Or copy its address and use that as the image source.
            </p>
            {/* The checkerboard shows which parts are see-through. */}
            <div
              className="overflow-hidden rounded-lg border border-accent/30"
              style={{
                backgroundColor: "#2a2f33",
                backgroundImage:
                  "linear-gradient(45deg,#353b40 25%,transparent 25%),linear-gradient(-45deg,#353b40 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#353b40 75%),linear-gradient(-45deg,transparent 75%,#353b40 75%)",
                backgroundSize: "24px 24px",
                backgroundPosition: "0 0,0 12px,12px -12px,-12px 0",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePath}
                alt={`Player names: ${radiant} (Radiant) vs ${dire} (Dire)`}
                width={1920}
                height={1080}
                className="block h-auto w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={imagePath}
                download={`overlay-${radiant}-vs-${dire}.png`.replace(/\s+/g, "-")}
                className="rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
              >
                Download PNG
              </a>
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="cursor-pointer rounded-lg border border-info px-4 py-2 text-sm font-semibold text-[#b5d4f4] hover:bg-info/15"
              >
                {copied ? "Copied" : "Copy image address"}
              </button>
              <a
                href={imagePath}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold hover:border-accent"
              >
                Open full size
              </a>
            </div>
          </>
        )}

        <details className="rounded-lg border border-accent/20 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">Adjust positions</summary>
          <p className="mt-2 text-xs text-muted/70">
            Line the names up under the hero portraits in the top bar once (e.g. against a 1080p screenshot); the
            image address keeps these settings.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SLIDERS.map((slider) => (
              <label key={slider.key} className="flex flex-col gap-1 text-xs">
                <span className="flex justify-between">
                  <span>{slider.label}</span>
                  <span className="tabular-nums text-muted">{layout[slider.key]}px</span>
                </span>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  value={layout[slider.key]}
                  onChange={(e) => setLayout((current) => ({ ...current, [slider.key]: Number(e.target.value) }))}
                  className="accent-[#1d9e75]"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLayout(DEFAULT_LAYOUT)}
            className="mt-3 cursor-pointer text-xs text-muted underline hover:text-paper"
          >
            Reset to defaults
          </button>
        </details>
      </section>
    </main>
  );
}
