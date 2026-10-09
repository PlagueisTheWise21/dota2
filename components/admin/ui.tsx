import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/** Small building blocks for the admin page, in the site's dark style. */

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-2 border-paper/60 bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/30 px-4 py-2">
        <h2 className="font-display text-lg font-bold tracking-widest uppercase">{title}</h2>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-display text-xs font-bold tracking-widest text-paper/80 uppercase">{label}</span>
      {children}
      {hint && <span className="text-xs text-paper/50">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full border border-paper/40 bg-[#202020] px-2 py-1.5 text-sm text-paper placeholder:text-paper/30 focus:border-paper focus:outline-none disabled:opacity-50";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "normal" | "primary" | "danger";
};

export function Button({ variant = "normal", className = "", type = "button", ...props }: ButtonProps) {
  const colours = {
    normal: "border-paper/60 bg-[#202020] hover:border-paper",
    primary: "border-paper bg-paper text-ink hover:bg-white",
    danger: "border-[#ef4444]/70 bg-[#2a1414] text-[#fca5a5] hover:border-[#ef4444]",
  }[variant];
  return (
    <button
      type={type}
      {...props}
      className={`cursor-pointer border-2 px-3 py-1.5 font-display text-sm font-bold tracking-widest whitespace-nowrap uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        variant === "primary" ? "" : "text-paper"
      } ${colours} ${className}`}
    />
  );
}

/** A one-line result under a form: green for success, red for errors. */
export function Message({ message }: { message: { kind: "ok" | "error"; text: string } | null }) {
  if (!message) return null;
  return (
    <p role="status" className={`text-sm ${message.kind === "error" ? "text-[#f87171]" : "text-[#4ade80]"}`}>
      {message.text}
    </p>
  );
}

export type FormMessage = { kind: "ok" | "error"; text: string } | null;

export function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

// --- Dates (the site shows deadlines in UTC, so the admin page edits UTC) ---

/** "2026-10-22T08:00" for a datetime-local input, in UTC. */
export function toUtcInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16) : "";
}

/** The input's value read as UTC, as an ISO string; null when empty. */
export function fromUtcInput(value: string): string | null {
  return value ? new Date(`${value}:00Z`).toISOString() : null;
}

export function formatUtc(iso: string | null): string {
  if (!iso) return "—";
  return `${new Date(iso).toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} UTC`;
}
