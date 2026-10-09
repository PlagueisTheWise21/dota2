"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "working" | "copied" | "downloaded" | "failed";

const STATUS_TEXT: Record<Exclude<Status, "idle">, string> = {
  working: "Copying...",
  copied: "Copied!",
  downloaded: "Downloaded",
  failed: "Could not copy",
};

type CopyImageButtonProps = {
  /** Draws the picture (e.g. lib/tier-image.ts). */
  render: () => Promise<Blob>;
  /** File name for the download fallback, e.g. "blast-slam-viii-tier-list.png". */
  fileName: string;
  /** What is copied, for screen readers and the tooltip, e.g. "tier list". */
  what: string;
};

/**
 * Copies a picture to the clipboard as a PNG. Browsers that cannot put
 * images on the clipboard get a download instead.
 */
export function CopyImageButton({ render, fileName, what }: CopyImageButtonProps) {
  const [status, setStatus] = useState<Status>("idle");

  // Clear "Copied!" and the other messages after a moment.
  useEffect(() => {
    if (status === "idle" || status === "working") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleClick() {
    if (status === "working") return;
    setStatus("working");

    // Start drawing straight away: Safari only allows the clipboard write if
    // it begins during the click, so it is given the unfinished image.
    const png = render();

    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard images not supported");
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setStatus("copied");
    } catch {
      try {
        downloadPng(await png, fileName);
        setStatus("downloaded");
      } catch (error) {
        console.error(`Copying the ${what} as an image failed:`, error);
        setStatus("failed");
      }
    }
  }

  const label = status === "idle" ? null : STATUS_TEXT[status];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "working"}
        aria-label={`Copy ${what} as image`}
        title={`Copy ${what} as image`}
        className="shadow-offset flex h-full cursor-pointer items-center gap-2 border-2 border-paper/60 bg-panel px-[clamp(0.5rem,1.5vw,0.9rem)] py-[calc(clamp(0.2rem,0.9dvh,0.45rem)+1px)] font-display text-[clamp(0.85rem,min(2vw,2.8dvh),1.15rem)] font-bold tracking-widest whitespace-nowrap text-paper uppercase transition-colors hover:border-paper disabled:cursor-wait disabled:opacity-70"
      >
        {status === "copied" || status === "downloaded" ? <CheckIcon /> : <CopyIcon />}
        <span className="hidden 2xl:inline">Copy image</span>
      </button>

      <span
        role="status"
        className="pointer-events-none absolute top-full right-0 mt-2 text-xs whitespace-nowrap text-paper/80"
      >
        {label}
      </span>
    </div>
  );
}

function downloadPng(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[1.1em] w-[1.1em]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="square">
      <rect x="8" y="8" width="13" height="13" />
      <path d="M16 8V3H3v13h5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[1.1em] w-[1.1em]" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="square">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}
