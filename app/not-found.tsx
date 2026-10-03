import Link from "next/link";
import { Panel } from "@/components/Panel";

/** Shown for unknown URLs, including event links that match no event. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-8 px-4">
      <Panel className="px-10 py-8 text-center">
        <h1 className="font-display text-3xl font-bold tracking-wide uppercase">
          Page not found
        </h1>
        <p className="mt-2">That event or page does not exist.</p>
      </Panel>
      <Link href="/" className="text-sm text-paper/70 underline hover:text-paper">
        Back to events
      </Link>
    </main>
  );
}
