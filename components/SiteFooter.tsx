import Link from "next/link";

/** Slim footer: the Valve disclaimer and a link to the privacy page. */
export function SiteFooter() {
  return (
    <footer className="relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[0.7rem] text-muted/60">
      <span>
        Not affiliated with Valve. Dota 2 is a registered trademark of Valve Corporation.
      </span>
      <span aria-hidden="true">·</span>
      <span>Match data from Liquipedia (CC BY-SA 3.0)</span>
      <span aria-hidden="true">·</span>
      <Link href="/privacy" className="underline hover:text-paper">
        Privacy
      </Link>
    </footer>
  );
}
