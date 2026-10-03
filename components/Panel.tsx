import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The site's signature content box: light background, hard black border and
 * a solid offset shadow. Used for the welcome message and section headings.
 */
export function Panel({ children, className = "" }: PanelProps) {
  return (
    <div
      className={`shadow-offset border-[3px] border-black bg-paper text-steel ${className}`}
    >
      {children}
    </div>
  );
}
