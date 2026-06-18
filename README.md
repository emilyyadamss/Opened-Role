# Opened Role

A social network for finding the missing person on your project. Post what you're
building and the roles you need (mechanical engineer, software engineer, designer…),
and let people with those skills tap you on the shoulder.

## Running it

```sh
npm install
cp .env.example .env.local   # then fill in your Supabase keys (see Setup below)
npm run dev
```

Then open http://localhost:5173.

## Setup (Supabase backend)

The app runs on [Supabase](https://supabase.com) — a hosted Postgres database with
auth and row-level security. First-time setup:

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier is
   plenty). Wait for it to finish provisioning.
2. **Create the schema.** In the dashboard, open **SQL Editor → New query**, paste
   the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
   and run it. This creates the tables, row-level-security policies, the
   new-user trigger, and turns on realtime. Then run
   [`supabase/migrations/0002_resumes_storage.sql`](supabase/migrations/0002_resumes_storage.sql)
   the same way to create the private `resumes` storage bucket and its policies.
3. **Get your keys.** **Project Settings → API**, and copy them into `.env.local`:
   - `VITE_SUPABASE_URL` ← Project URL
   - `VITE_SUPABASE_ANON_KEY` ← `anon` `public` key
   - `SUPABASE_SERVICE_ROLE_KEY` ← `service_role` key (used only by the seed script)
4. **(Recommended for the demo) Turn off email confirmation** so accounts work
   instantly: **Authentication → Providers → Email → uncheck "Confirm email"**.
   Leave it on if you want real email verification — new sign-ups will then need to
   click a link before they can sign in.
5. **Seed the demo content** (9 builders, their projects, tools, and applications)
   as real, sign-in-able accounts:
   ```sh
   npm run seed
   ```
   It's safe to re-run. Demo sign-in afterwards: `emily@openedrole.dev` / `openedrole`.

## What's inside

- **Discover** — browse projects, search by role or skill, filter by category or
  work mode (remote / hybrid / in-person), flip on "Matches my skills" to see only
  projects with open roles you can fill, or "Near me" to find projects with open
  in-person or hybrid roles within a chosen radius of your profile location
  (sorted nearest first, with distances on the cards).
- **Project pages** — full description, open roles with skill tags (green = you
  match), the current team, and one-click applications with a message.
- **Owner view** — on your own projects you see applicants and can accept or
  decline; accepted people join the team and the role slot fills.
- **People** — browse member profiles, filter by skill.
- **Dashboard** — projects you lead (with pending-applicant badges) and the status
  of every application you've sent.
- **Post a project** — guided form with a dynamic role builder and skill matching.

## Tech notes

Vite + React + TypeScript on a Supabase (Postgres) backend. Data is shared across
everyone — projects, applications, and team membership are real rows, protected by
row-level security so people can only edit their own. Open the app in two browsers
and changes appear in both live (Supabase realtime).

- **Auth** — real email + password via Supabase Auth. Sign in, or create a new
  account from the login screen. A Postgres trigger creates a profile row for every
  new sign-up. Edit your profile from the avatar in the navbar, or "Sign out" there.
- **Data layer** — [`src/store.tsx`](src/store.tsx) loads everything on sign-in and
  applies each change optimistically (instant UI) while writing to Supabase in the
  background; on a failed write it re-syncs from the server. Realtime subscriptions
  keep every open tab current.
- **Schema & policies** live in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql);
  the demo seed is [`scripts/seed.mts`](scripts/seed.mts) (`npm run seed`).
