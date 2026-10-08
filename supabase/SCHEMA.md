# Supabase schema reference

Snapshot of the `public` schema, taken 3 October 2026 from the live database.
Update this file whenever a table or column changes.

The database has the three core tables below plus the Liquipedia tables further down. The prediction, results, scores and
profiles tables were dropped on 3 October 2026 and will be redesigned when those
features are built.

Row Level Security is enabled on every table.

## Access policies
| Table | Policy | Allows |
|---|---|---|
| events | Anyone can view events | read, everyone |
| teams | Anyone can view teams | read, everyone |
| event_teams | Anyone can view event teams | read, everyone |

There are no insert, update or delete policies, so data can only be changed from
the Supabase dashboard. The old admin policies and the `is_admin()` function were
removed on 3 October 2026; admin access will be redesigned in Phase 8.

All `id` columns are `uuid` with default `gen_random_uuid()`.

## events
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | primary key |
| name | text | no | |
| slug | text | no | no unique constraint |
| start_date | timestamptz | no | |
| end_date | timestamptz | no | |
| prediction_deadline | timestamptz | no | |
| status | text | no | free text, no allowed-values check |
| created_at | timestamptz | no | default now() |
| image_url | text | yes | homepage banner |

## teams
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | primary key |
| name | text | no | |
| short_name | text | yes | |
| logo_url | text | yes | |
| created_at | timestamptz | no | default now() |

## event_teams
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | primary key |
| event_id | uuid | no | FK -> events, unique with team_id |
| team_id | uuid | no | FK -> teams |
| seed | smallint | yes | |

## Liquipedia tables (agreed 8 October 2026)
Created by `supabase/migrations/20261008_liquipedia.sql` (run in the SQL editor).
Filled by `npm run sync -- <Liquipedia page>` with the service role key; the site
only reads them. Readable by everyone (select grant + policy), no API writes.

New columns:
- `events.liquipedia_page` (text, unique): e.g. `PGL/Wallachia/9`.
- `teams.liquipedia_template` (text, unique): e.g. `xtreme gaming orig`.

### matches
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| event_id | uuid | FK -> events, cascade delete |
| liquipedia_id | text | unique, Liquipedia match2id |
| stage | text | 'group' or 'playoffs' |
| section | text | 'Round 1', 'Playoffs' |
| bracket_section | text | 'upper', 'lower' or null |
| round | smallint | |
| match_number | smallint | order within the round |
| team1_id, team2_id | uuid | FK -> teams, null while TBD |
| score1, score2 | smallint | null until played |
| winner | smallint | 1, 2 or null |
| best_of | smallint | |
| starts_at | timestamptz | |
| finished | boolean | default false |
| winner_to, winner_to_slot | text, smallint | next match (liquipedia_id) and slot 1/2 |
| loser_to, loser_to_slot | text, smallint | lower-bracket drop; derived by the sync (rule checked against results) |
| updated_at | timestamptz | |

### group_standings
`id`, `event_id` (FK), `team_id` (FK), `round`, `placement`, `wins`, `losses`,
`draws`, `status` (Liquipedia: 'up', 'down', ...). Unique (event_id, team_id, round).

### event_placements
`id`, `event_id` (FK), `team_id` (FK), `place_from`, `place_to`, `prize_money`.
Unique (event_id, team_id). Real placement groups, e.g. 9-11.

## What the code reads today
- Homepage (`lib/events.ts`, `getEvents`): `events.id`, `events.name`, `events.image_url`, ordered by `events.start_date`.
- Event page (`lib/events.ts`, `getEvent`): `events.id, name, start_date, end_date, prediction_deadline, status`,
  plus `event_teams.seed` and `teams.id, name, short_name, logo_url` through `event_teams`.
  Teams are ordered by `seed` (unseeded last, then by name); the seed is not displayed.
- Logo route (`app/api/logo/route.ts`): `teams.logo_url`, to check a requested URL
  is a real team logo before fetching it.

## Storage
| Bucket | Public | Holds |
|---|---|---|
| team-logos | yes (planned; create in the dashboard) | small trimmed team logos made by `npm run logos`; `teams.logo_url` points at them |
