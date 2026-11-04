# dogear.

> leave a little piece of yourself in every book.

A social network for readers: shelves, a reading diary, editorial reviews, shareable quote cards, collage-covered lists, a living feed, and the social graph around them. It's built with Next.js (App Router), TypeScript, Tailwind CSS v4, Supabase (Auth, Postgres + RLS, Storage) and the Open Library API.

## Quick start (demo mode, no credentials needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Supabase keys configured, dogear. runs in **demo mode**:

- A clearly labelled banner says you're on sample data.
- Data lives in a local file store (`.data/demo-db.json`), seeded with 10 fictional readers, 47 real books, reviews, quotes, lists, comments and passes.
- On the login page you can step into a sample reader, or sign in as any of them with `<username>@demo.dogear.app` / `dogear-demo` (for example `margo@demo.dogear.app`). You can also sign up for a fresh account and go through onboarding.
- **Settings → Reset demo data** (or `npm run demo:reset`) restores the seed.

Demo mode enforces the same permission rules as the Supabase policies. It's there for development and design review; it isn't a production backend.

## Going live with Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema. With the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push            # runs supabase/migrations/*
   ```
   Or paste `supabase/migrations/20261104000000_init.sql` into the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in:

   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` public key |
   | `NEXT_PUBLIC_SITE_URL` | Your deployed origin (used in OAuth / email redirects) |
   | `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `true` once Google is enabled (step 5) |

   The app only uses the **anon** key; Row Level Security enforces every permission. Never add a service-role key to this app.
4. Under Authentication → URL Configuration, add `<SITE_URL>/auth/callback` to the redirect URLs.
5. *(Optional)* Google sign-in: enable the Google provider under Authentication → Providers, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
6. *(Optional, local/staging only)* Load the sample community: `psql "$DATABASE_URL" -f supabase/seed.sql`. The CLI also runs it on `supabase db reset`. Regenerate it with `npm run db:seed:generate`.

Storage: the migration creates a public `media` bucket. Users can only write under their own `<user-id>/` folder (avatars, profile covers, list images).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · route typegen + `tsc` |
| `npm run db:test:rls` | RLS permission smoke test (needs `DATABASE_URL`; runs in a rolled-back transaction) |
| `npm run db:seed:generate` | Rebuild `supabase/seed.sql` from the demo community |
| `npm run db:types` | Generate Supabase TypeScript types (CLI, linked project) |
| `npm run demo:reset` | Delete the local demo store |

## Project map

```
src/
  app/
    page.tsx                 landing
    (auth)/                  login · signup · onboarding
    (app)/                   the signed-in shell (sidebar / bottom tabs)
      home/                  feed: Following + Discover tabs, composer
      discover/              masonry pinboard, trending, moods, genres, readers
      search/                books (catalogue + Open Library) and readers
      book/[key]/            book page — key is our slug or an Open Library work id
      u/[username]/…         profile: overview, shelves, reviews, lists, quotes, reading year
      post/[id]/             thread with comments and replies
      review|quotes|lists/   create & edit flows
      notifications/ bookmarks/ diary/ settings/
    quotes/[id]/card/        1080×1350 shareable PNG (next/og, brand fonts)
    actions/                 server actions (zod-validated)
  components/                design system + feature components
  lib/
    data/store.ts            the DataStore contract
    data/supabase/           Supabase implementation (RLS does the permissions)
    data/demo/               demo implementation + seed
    openlibrary.ts           Open Library client (cached, short timeouts)
supabase/
  migrations/                schema, triggers, RPCs, RLS, storage policies
  tests/rls_smoke.sql        permission tests
  seed.sql                   generated sample community
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design decisions.

Book metadata and covers come from [Open Library](https://openlibrary.org/developers/api). Missing covers fall back to typeset jackets.
