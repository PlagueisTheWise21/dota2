import type { Metadata } from "next";
import { MyPicks } from "@/components/MyPicks";

export const metadata: Metadata = { title: "My picks", robots: { index: false, follow: false } };

/** The signed-in person's saved tier lists and pick'ems, across all events. */
export default function MyPicksPage() {
  return <MyPicks />;
}
