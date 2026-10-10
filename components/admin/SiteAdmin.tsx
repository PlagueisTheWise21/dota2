"use client";

import { useEffect, useState } from "react";
import { Button, errorText, Field, Message, Section, TextInput, type FormMessage } from "@/components/admin/ui";
import { faviconFromFile } from "@/lib/admin-images";
import {
  loadSiteSettings,
  removeOwnImage,
  saveSiteSettings,
  uploadImage,
  type SiteSettingsInput,
} from "@/lib/admin";

/**
 * Site settings: the browser tab title and tab icon (table site_settings).
 * Every change clears the cached pages (via reload), so it shows straight away.
 */
export function SiteAdmin({ reload }: { reload: () => Promise<void> }) {
  const [saved, setSaved] = useState<SiteSettingsInput | null>(null);
  const [title, setTitle] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);

  useEffect(() => {
    let cancelled = false;
    loadSiteSettings()
      .then((settings) => {
        if (cancelled) return;
        setSaved(settings);
        setTitle(settings.site_title);
      })
      .catch((reason) => !cancelled && setLoadError(errorText(reason)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function apply(changes: Partial<SiteSettingsInput>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await saveSiteSettings(changes);
      if (saved?.favicon_url && saved.favicon_url !== next.favicon_url) {
        await removeOwnImage("site-assets", saved.favicon_url);
      }
      setSaved(next);
      setTitle(next.site_title);
      await reload();
      setMessage({ kind: "ok", text: done });
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
    } finally {
      setBusy(false);
    }
  }

  async function uploadIcon(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const url = await uploadImage("site-assets", "tab-icon", await faviconFromFile(file));
      await apply({ favicon_url: url }, "Tab icon updated.");
    } catch (reason) {
      setMessage({ kind: "error", text: errorText(reason) });
      setBusy(false);
    }
  }

  if (loadError) return <p className="text-sm text-[#f87171]">{loadError}</p>;
  if (!saved) return <p className="text-muted/70">Loading...</p>;

  const iconSrc = saved.favicon_url ?? "/favicon.ico";
  const previewTitle = title.trim() || "Dota 2 Predictions & Tier Lists";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Section title="Browser tab">
        {/* What a browser tab will look like. */}
        <div className="mb-5 flex items-end gap-1 rounded-t-lg bg-[#071318] px-3 pt-3">
          <div className="flex w-64 items-center gap-2 rounded-t-lg bg-card px-3 py-2 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc} alt="" className="h-4 w-4 shrink-0 object-contain" />
            <span className="truncate">{previewTitle}</span>
          </div>
          <div className="flex w-56 items-center gap-2 rounded-t-lg px-3 py-2 text-sm text-muted/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc} alt="" className="h-4 w-4 shrink-0 object-contain opacity-60" />
            <span className="truncate">BLAST Slam VIII | {previewTitle}</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_14rem]">
          <div className="flex flex-col gap-3">
            <Field label="Tab title" hint="The homepage shows it alone; other pages show “Page name | title”.">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={70} />
            </Field>
            <div>
              <Button
                variant="primary"
                disabled={busy || !title.trim() || title.trim() === saved.site_title}
                onClick={() => void apply({ site_title: title.trim() }, "Tab title saved.")}
              >
                Save title
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-display text-xs font-bold tracking-widest text-paper/80 uppercase">Tab icon</span>
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-accent/30 bg-card p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconSrc} alt="Current tab icon" className="max-h-full max-w-full object-contain" />
              </span>
              <span className="text-xs text-muted/70">{saved.favicon_url ? "Custom icon" : "Default icon"}</span>
            </div>
            <label className="cursor-pointer rounded-lg border border-accent/40 bg-card px-3 py-1.5 text-center font-display text-sm font-bold tracking-widest uppercase hover:border-accent">
              {busy ? "Saving..." : "Upload icon"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadIcon(file);
                }}
              />
            </label>
            {saved.favicon_url && (
              <Button disabled={busy} onClick={() => void apply({ favicon_url: null }, "Back to the default icon.")}>
                Use default
              </Button>
            )}
            <p className="text-xs text-muted/60">
              A square image works best (it&apos;s fitted into a 128×128 PNG). Browsers may keep showing the old
              icon until the page is reloaded.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Message message={message} />
        </div>
      </Section>
    </div>
  );
}
