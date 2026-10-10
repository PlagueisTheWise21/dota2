import { cache } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Site-wide settings the admin can change (table `site_settings`, one row;
 * supabase/migrations/20261010c_site_settings.sql): the browser tab title and
 * the tab icon. Used by app/layout.tsx for every page's <title> and icon.
 */
export type SiteSettings = {
  /** Tab title: the homepage shows it alone, other pages as "Page | title". */
  site_title: string;
  /** Uploaded tab icon (Storage bucket site-assets); null = /favicon.ico. */
  favicon_url: string | null;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  site_title: "Dota 2 Predictions & Tier Lists",
  favicon_url: null,
};

/** The settings, or the defaults if they can't be read (e.g. before the SQL is run). */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (!supabase) return DEFAULT_SITE_SETTINGS;
  const { data, error } = await supabase
    .from("site_settings")
    .select("site_title, favicon_url")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULT_SITE_SETTINGS;
  return {
    site_title: data.site_title?.trim() || DEFAULT_SITE_SETTINGS.site_title,
    favicon_url: data.favicon_url || null,
  };
});
