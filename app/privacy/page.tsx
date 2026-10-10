import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Privacy" };

/**
 * How to reach the site owner for data requests. Shown on this page; edit it
 * to your preferred contact (e.g. a Twitch channel, Discord or email).
 */
const CONTACT = "the site owner";

const UPDATED = "10 October 2026";

/** What the site stores about people and why. Plain-language privacy notice. */
export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="shadow-offset rounded-xl border border-accent/40 bg-panel px-4 py-2 font-display font-bold tracking-widest uppercase hover:border-accent"
          >
            Home
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase">Privacy</h1>
          <span className="w-[5.5rem]" aria-hidden="true" />
        </header>

        <article className="flex flex-col gap-5 rounded-xl border border-accent/30 bg-panel/95 px-6 py-6 text-sm leading-relaxed text-paper/90">
          <p className="text-muted/80">Last updated {UPDATED}.</p>

          <Part title="What we store">
            <p>You can use the site without signing in; then nothing about you is stored. If you sign in with Twitch, we keep:</p>
            <ul className="list-disc pl-5">
              <li>your Twitch account id, display name, login name and profile picture (from Twitch when you sign in);</li>
              <li>the tier lists and pick&apos;ems you save, and when you saved them.</li>
            </ul>
            <p>We never see or store your Twitch password, email or anything else from your Twitch account.</p>
          </Part>

          <Part title="Why">
            <p>
              To save your tier lists and pick&apos;ems so they&apos;re there when you come back, and to show your name and picture on
              event leaderboards.
            </p>
          </Part>

          <Part title="Who can see it">
            <ul className="list-disc pl-5">
              <li>Your tier lists are private: only you can see them.</li>
              <li>
                Your pick&apos;ems are private until that stage&apos;s picks lock. After that they&apos;re public and count on the
                leaderboard, with your Twitch name and picture.
              </li>
            </ul>
          </Part>

          <Part title="Where it's kept">
            <p>
              Accounts and picks are stored with Supabase (database and sign-in) and the site runs on Vercel. Signing in goes
              through Twitch. Your browser keeps your sign-in session and, briefly while signing in, your unsaved picks. We
              don&apos;t use advertising or tracking cookies, and we don&apos;t sell or share your data.
            </p>
          </Part>

          <Part title="Deleting your data">
            <p>
              Signing out removes your session from your browser. To have your account and saved picks deleted, contact{" "}
              {CONTACT}. Data from your Twitch account is only updated when you sign in again.
            </p>
          </Part>

          <Part title="Credits">
            <p>
              Match data comes from Liquipedia (CC BY-SA 3.0). This site is a fan project and isn&apos;t affiliated with Valve.
              Dota 2 and its artwork belong to Valve Corporation.
            </p>
          </Part>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-bold tracking-wide text-paper uppercase">{title}</h2>
      {children}
    </section>
  );
}
