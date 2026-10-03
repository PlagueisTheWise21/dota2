# Project brief and handoff

Dota 2 Esports Predictions & Tier Lists. A fresh rebuild of an older project.
Do not assume anything from the old project should be reused unless the owner says so.

This file is the owner's brief plus the state of the project as of 3 October 2026.
Database structure lives in `supabase/SCHEMA.md`.

## Stack
Next.js 16 (App Router, root-level `app/`, no `src/`), TypeScript, Tailwind CSS v4,
Supabase, GitHub, VS Code / Claude Code.

## What the site will eventually do
1. Browse Dota 2 tournaments/events.
2. Open an individual event page.
3. View the teams in an event.
4. Create tier lists ranking those teams.
5. Predict tournament results / final positions.
6. Log in with Twitch (via Supabase Auth).
7. View your own predictions and tier lists.
8. Leaderboards, results, profiles.

## Roadmap
Only build a phase when the owner explicitly asks for it.

- Phase 1: foundation and homepage (built; see "Current state")
- Phase 2: event pages, event details, participating teams
- Phase 3: tier list page, drag/drop, saving tier lists
- Phase 4: predictions, final-position predictions, deadlines
- Phase 5: results, scoring, leaderboards
- Phase 6: user profiles
- Phase 7: Twitch authentication
- Phase 8: admin functionality, event/team management
- Phase 9: Liquipedia / event data integration if appropriate

Not yet: Twitch login, login screens, predictions, leaderboards, the full event page.
Do not over-engineer.

## Design language
- Dark esports / Dota 2 feel; a dedicated community site, not a generic dashboard.
- Page background about `#0b0b0b`, never a flat single colour: barely visible Dota
  text as texture. Dark greys for panels.
- Light content boxes on the dark page, black borders, strong rectangular shapes,
  slight solid offset shadows, large centred headings, blue/grey text on light boxes.
- Clean layouts, strong contrast, minimal UI. Avoid heavy gradients and rounded
  "modern SaaS" styling. An event-poster feel.

## Homepage requirements
- Fits the viewport and never scrolls vertically, on desktop, laptop and smaller
  screens. No fixed desktop heights.
- Order: welcome panel, "Events" heading, horizontal event carousel.
- Events come from Supabase, never hard-coded. Banner image is `events.image_url`.
  No image: show a placeholder with the event name.
- Carousel: about 3 banners on desktop, aspect ratio kept, any number of events,
  arrows only when there are more than fit. Clicking goes to `/events/[event-id]`.
- Cards: black border, subtle shadow, slight hover lift/scale, pointer cursor,
  slight brightness increase on hover.

## Tier list page (Phase 3; preserve this existing style)
- `#0b0b0b` background, centred, max width about 760px, compact, about 6 cards per row.
- Tiers S/A/B/C/F with coloured labels:
  S `#ef4444`, A `#f97316`, B `#eab308`, C `#22c55e`, F `#8b5cf6`.
- Tier row min height 104px; tier label about 64px wide.
- Team card 104px x 82px; logo area about 52px high and most prominent; name below.
- Drag and drop between tiers; an Unranked section.
- Cards wrap; tier rows and the Unranked section grow as teams are added.
- Only show teams in the selected event (`event_teams`).

## Working rules
- Inspect before changing: project structure, package.json, Supabase client,
  Tailwind setup, existing components. Do not blindly overwrite.
- Keep what works unless there is a clear reason to change it.
- Explain new files briefly. For database code, name the exact table and columns.
- On errors: likely cause, brief explanation, smallest fix, no unrelated rewrites.
- When asked for a file, give the complete file with complete imports. Working
  TypeScript, no pseudocode, readable components.
- Design changes must preserve existing behaviour unless told otherwise.
- Explain major architectural changes before making them.
- Do not create database tables without discussing them first. Recommend column
  additions/removals with reasons and wait for agreement.
- Supabase client is imported from `@/lib/supabase`. Credentials live only in
  `.env.local`, which is never committed. No service-role key in the frontend.
- Git: change, test locally, review, commit with a descriptive message, push.
  Do not commit on every save.

## Current state (3 October 2026)

### Built
- `lib/supabase.ts`: shared client; `null` if env vars are missing. Reads
  `NEXT_PUBLIC_SUPABASE_URL` and the key from `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
  The owner's `.env.local` uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `lib/events.ts`: `getEvents()` for the homepage; `getEvent(id)` for the event page
  (event plus its teams via `event_teams`; see `supabase/SCHEMA.md`).
- `components/`: `SiteBackground`, `Panel`, `EventCard`, `EventCarousel`,
  `FallbackImage` (image with placeholder when the URL is empty or broken),
  `EventView` (event page shell), `TierList` (drag-and-drop tier list).
- `lib/tier-layout.ts`: picks the tier list's width and card scale so it fits the
  screen without scrolling (760px wide first, then wider, then smaller cards).
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`: homepage, fonts (Geist + Oswald
  as `font-display`), colour tokens (`ink`, `panel`, `paper`, `steel`), carousel CSS.
- `app/events/[id]/page.tsx`: event page. Header (name, dates, status, back link) and
  an in-page switch between Tier List and Predictions (no navigation).
  - Tier list: S/A/B/C/F plus Unranked; all teams start in Unranked in seed order;
    mouse/touch drag between and within tiers; Escape cancels a drag. Not saved:
    a refresh resets it (saving needs a table and login; later phases).
  - "Copy image" button (tier list only): `lib/tier-image.ts` draws the tier list
    on a canvas (full card size, 760px board, event name as title) and copies it
    to the clipboard as a PNG; browsers without clipboard images get a download.
  - Predictions (`components/Predictions.tsx`, rough outline): a Liquipedia-style
    placement table (1, 2, 3, 4, 5–6, 7–8, 9–12, 13–16…, from `lib/placements.ts`)
    beside a box of unplaced teams; drag teams into slots, drop on a filled slot
    to swap, drag back to the box to remove. Shows `events.prediction_deadline`
    but does not lock yet. Not saved; login will be optional.
  - Dragging for both sections is shared in `components/useCardDrag.ts`; trimmed
    team logos in `components/TeamLogo.tsx`.
- The owner has a Liquipedia API key, for Phase 9. It must go in `.env.local`
  without a `NEXT_PUBLIC_` prefix (server only) and never in code or chat.
- `app/api/logo/route.ts`: serves a team logo from this site so the browser may
  read its pixels (for trimming and the copied image). Only fetches URLs found in
  `teams.logo_url`. Some hosts refuse server requests (Fandom/Wikia did); such a
  logo shows untrimmed on the page and as its short name in copied images.
- `lib/logo-trim.ts`: trims empty margins off logos in the browser (via the logo
  route) and shrinks them to 256px, once per visit. Cards and the copied image
  both use it. Team cards: logo area 60px of the 82px card, one-line name.
- Team cards (tier list, its copied image) and team boxes (predictions) share
  one look, chosen by the owner: dark `#202020` box, 1px light outline at 60%
  (full on hover/drag), light text, thin light line between logo and name.
- The project lives on a D: drive whose file system does not support Windows
  junctions or file ownership. Git needs `safe.directory` for it, and the dev
  server crashes on native server packages such as `sharp`. Avoid those, or move
  the project to an NTFS drive (e.g. C:).
- `app/not-found.tsx`: styled 404, also used for unknown or malformed event ids.
- Welcome wording is placeholder text in two constants at the top of `app/page.tsx`.
- Event data in Supabase is demo data for testing, not accurate.

### Confirmed
- The owner reports the homepage loads events from Supabase and "works nicely".
- Lint and production build pass. Homepage no-scroll layout checked from 320x480
  to 1440x900. Event page tier list fits without scrolling from 1920x1080 down to
  phone portrait; on a landscape phone (about 812x375) the board scrolls inside
  itself once cards reach the minimum size.
- Git initialised; `main` pushed to github.com/PlagueisTheWise21/dota2.

### Not yet verified
- Whether the old sign-up trigger on `auth.users` (which inserted into the dropped
  `profiles` table) was removed. Check before adding authentication.

### Database decisions made
- Only `events`, `teams`, `event_teams` remain. `predictions`, `prediction_positions`,
  `scores`, `event_results`, `results` and `profiles` were dropped on purpose and
  will be redesigned when those features are built.
- Event ids are uuids, so URLs are `/events/<uuid>`.
- Public read policies and `select` grants exist on all three tables for `anon`
  and `authenticated`. No write access through the API; data is edited in the
  Supabase dashboard. Old admin policies and `is_admin()` were removed.
- New tables need both a grant and an RLS policy, or queries fail with
  "permission denied for table ...".

### Suggested later (not agreed yet)
- `events.slug`: add a unique constraint (Phase 2).
- `events.status`: restrict to fixed values (Phase 2).
- A table for saved tier lists (Phase 3).

### Sensible next steps
1. Owner reviews the event page and tier list.
2. Agree a table for saved tier lists before building saving (needs login, Phase 7).
3. Design the predictions tables before Phase 4.
