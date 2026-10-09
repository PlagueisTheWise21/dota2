import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/AdminApp";

export const metadata: Metadata = {
  title: "Admin | Dota 2 Predictions",
  robots: { index: false, follow: false },
};

/**
 * Admin panel: manage events, their teams, deadlines and Liquipedia syncs,
 * and teams with their logos. The sign-in lives in the browser, so the page
 * checks admin rights there (components/admin/AdminApp.tsx); the database
 * refuses changes from anyone who is not in public.admins.
 */
export default function AdminPage() {
  return <AdminApp />;
}
