import Link from "next/link";
import { Panel } from "@/components/Panel";

type EventPageProps = {
  params: Promise<{ id: string }>;
};

// Placeholder so event banners have somewhere to go.
// The real event page is built in Phase 2.
export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-8 px-4">
      <Panel className="px-10 py-8 text-center">
        <h1 className="font-display text-3xl font-bold tracking-wide uppercase">
          Event {id}
        </h1>
        <p className="mt-2">This event page is coming soon.</p>
      </Panel>
      <Link href="/" className="text-sm text-paper/70 underline hover:text-paper">
        Back to events
      </Link>
    </main>
  );
}
