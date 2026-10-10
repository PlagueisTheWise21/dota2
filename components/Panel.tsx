import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The site's title box: dark grey background, light outline, light text and
 * a solid offset shadow. Used for the welcome message, section headings and
 * the event name. lib/tier-image.ts draws the same look for the copied image.
 */
export function Panel({ children, className = "" }: PanelProps) {
  return (
    <div
      className={`shadow-offset rounded-xl border border-accent/40 bg-panel text-paper ${className}`}
    >
      {children}
    </div>
  );
}
