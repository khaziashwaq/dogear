# dogear. — architecture notes

## Shape of the system

```
Browser ──▶ Next.js (App Router, Node runtime)
              ├─ Server Components  → read through a per-request DataStore
              ├─ Server Actions     → validate (zod) → DataStore → revalidatePath
              ├─ proxy.ts           → refresh Supabase session; optimistic auth redirect
              └─ DataStore
                   ├─ SupabaseStore  → supabase-js as the viewer (anon key + user JWT) → Postgres + RLS
                   └─ DemoStore      → in-memory, file-persisted sample data (no credentials)
            Open Library API ◀── server-side fetch, 1h cache, 4.5s timeout
```

### One contract, two backends

`src/lib/data/store.ts` defines `DataStore`, the full contract the UI uses (profiles, catalogue, shelves, diary, reviews, quotes, lists, feed, comments, notifications, passes, stats). `getStore()` (`src/lib/auth.ts`) gives you one store per request, already bound to the viewer.

- **SupabaseStore** runs every query as the signed-in user. RLS decides visibility, so the store never filters for permissions itself.
- **DemoStore** puts the same rules (`canView`, follower checks, ownership) into code, so the demo behaves like production. The UI is labelled "Demo mode" whenever it's active.

Adding a backend, or a cache, means implementing one interface.

### Rendering model

The app is almost entirely per-viewer: feeds, shelf state, follow state, private content. So `cacheComponents` is **off** and pages render at request time. Static or shared data that's worth caching (Open Library responses) is cached at the fetch layer. Mutations call `revalidatePath`. Likes, bookmarks, reposts and follows update optimistically on the client and don't refresh the page.

## Data model

- **books**: one canonical row per work, shared by every reader. De-duplicated on `ol_work_id`, then `isbn13`. Rows are created lazily the first time anyone interacts with an Open Library result (`resolveBook` in `src/lib/server-action.ts` fetches the canonical work server-side; it doesn't trust client metadata unless Open Library is down). External ids are stored: ISBN-10/13, OL work id, and OL edition id.
- **user_books**: a reader's relationship to a book: shelf status (`want_to_read | reading | read | dnf`), current rating (0.5–5 in half steps, enforced by a check constraint), favourite flag, progress, and **custom shelves** as a `text[]` of user-defined tags. That makes custom shelves cheap to query (`@>`) without a join table.
- **reading_sessions**: the diary. One row per reading (re-reads included), with start/finish dates and private notes. Changing shelf status opens and closes sessions automatically.
- **reviews, quotes, lists (+ list_books)**: each has a `visibility` (`public | followers | private`).
- **posts**: the unified activity stream. Every shareable entity owns exactly one post (`review_id` / `quote_id` / `list_id` are unique FKs with `ON DELETE CASCADE`). Lightweight activity (`update`, `started`, `finished`, `recommendation`) and `repost` are posts too.
  - Likes, comments, bookmarks and reposts **only ever target posts**. The social layer is uniform: real foreign keys, one set of RLS policies, one counter mechanism.
  - A trigger keeps a post's visibility in sync with its entity.
- **comments**: one level of replies (`parent_id`; replies to replies attach to the thread root).
- **follows, list_follows, likes, bookmarks**: composite primary keys, so they're idempotent by construction.
- **recommendations** ("Pass the book"): sender → recipient with a note. `parent_id` links a pass to the pass that inspired it, which forms **book trails**.
- **notifications**: written only by `SECURITY DEFINER` triggers (follow, like, comment, reply, repost, recommendation, list follow). Clients can only read and mark their own.

Counters (`likes_count`, `followers_count`, …) are denormalised and maintained by triggers. Column-level grants stop clients writing counters or ownership columns.

## Security

- RLS is enabled on every table. Policies wrap `auth.uid()` in a sub-select so it's evaluated once per statement.
- `private.can_view(owner, visibility)` is the single visibility rule (public, owner, or followers-only for followers). It's `SECURITY DEFINER` in a non-exposed schema.
- Bookmarks, the diary and passes are private to their owners. Notifications are recipient-only.
- `private.can_view` also hides everything between readers who have blocked each other (`blocks`). Mutes (`mutes`) only drop someone from the viewer's feeds. Reports (`reports`) are private to the reporter; moderators use the service role.
- Storage: one public `media` bucket limited to 2 MB JPEG/PNG/WebP/GIF. Writes only to `<auth.uid()>/<file>.<image ext>`.
- The shared `books` catalogue is read-only to the API roles. The server writes it with the service role (`src/lib/supabase/admin.ts`, server-only) from Open Library data it fetched itself. The service role is also used for account deletion, and for nothing else.
- Column grants make ownership and parent references immutable: recommendations (only `seen_at`), notifications (`read_at`), comments (`body`), reviews and annotations (content and visibility, never `book_id`). A trigger keeps a post's visibility and book in step with the review, annotation or list it carries, and refuses a post wrapping someone else's content.
- URL columns are checked by the database: HTTPS only, images from our storage (or the Google photo for avatars), covers from Open Library.
- Abuse limits are database triggers (SQLSTATE `DG429`): comments, follows, passes, reports and automatic posts. Like, follow, repost and list-follow notifications are unique per actor and target.
- Shelf moves are one function (`set_shelf_status`): shelf entry, diary and an optional post in one transaction. They never post unless asked, and return an undo record (`undo_shelf_move`, 15 minutes).
- Feeds come from `following_posts()`, `discover_posts()` and `public_posts()`, which join follows and mutes in the database, so no ID lists travel in URLs.
- Production fails closed: `src/instrumentation.ts` refuses to start without Supabase and the service-role key, and sample-data mode only exists in development.
- `src/proxy.ts` sets a per-request nonce CSP (`strict-dynamic`). `next.config.ts` sets nosniff, `X-Frame-Options`, Referrer-Policy, Permissions-Policy and HSTS (production).
- Server actions validate every input with zod. Redirect targets (`next=`) are restricted to same-origin paths. Uploads are type- and size-checked (2 MB).
- Ratings: the shelf entry (`user_books.rating`) is the reader's one rating for a book; triggers keep the copy on their reviews in step (stars on a review set it; a new shelf rating updates their reviews).
- Logging a finished book is one function, `log_book` (diary entry with date, re-read and private notes; Read shelf; rating; optional review, favourite line and "finished" post), surfaced by `LogBookDialog` whenever a book is moved to Read. Reviews publish through `publish_review` (review + post atomically); lists reorder through `reorder_list`.
- Stats are aggregated by `reading_stats(user, year)`, scoped to the year. Under RLS a reader's own stats use their private diary (re-reads count); others see one completion per book from public shelves. Pages only add up for books with a known page count.
- Moods come from Open Library subject headings via `src/lib/moods.ts`, which also feeds mood pages from Open Library so they're never empty. `npm run catalogue:starter` imports a curated starter catalogue of real books (dry run unless `--apply --project <ref>`; `--enrich-moods` fills moods for existing books).
- Feed: the Following / Discover feeds filter by kind (`FeedFilter`); runs of plain "started" / "finished" posts by one reader collapse into one card (`src/lib/feed-group.ts`).
- Readers with similar taste: `similar_readers()` scores public overlap only (shared shelves, rating agreement, favourite authors, genres, favourites), never private diaries, never blocked or already-followed readers.
- Invites: `invites` (owner-visible) and `invite_redemptions` (no API access). `invite_preview(code)` is the only public view of an invite; `redeem_invite(code)` runs once per new reader (account under a week old) and follows the inviter. The code rides through Google sign-in in an httpOnly cookie and is claimed when onboarding finishes.
- Recaps: `reading_recap(user, year, month?)` powers the Yearbook and monthly recaps (`/u/<name>/recap`) and their share images. A Read book with no finish date counts all-time but never in a period. Share images for lists, recaps, reviews and annotations share `src/lib/og.tsx`.
- Goodreads import (`/import`): the CSV is parsed in the browser (`src/lib/goodreads.ts`); each book goes to `importGoodreadsRowAction`, which matches by ISBN (catalogue, then Open Library) or confidently by title + author, and writes through `import_shelf_entry` (no posts; existing books untouched unless overwriting).
- Function grants: functions that act for a reader are executable by `authenticated` only (PUBLIC execute revoked).
- Tests: `npm test` runs `tests/unit`, then `tests/db` (every migration applied to PGlite, a real Postgres, then RLS, grants and triggers exercised as `anon` and `authenticated`) and `tests/store` (the local store held to the same rules). `supabase/tests/rls_smoke.sql` is the older psql smoke test.

## Front end

- **Design tokens** live in `src/app/globals.css` (`@theme`): paper, ink, sage, rose, butter and burgundy; DM Serif Display, DM Sans, DM Mono and Caveat for the handwritten notes. There are a few signature primitives: `.paper`, `.dogear` (folded corner), `.tape`, `.ruled`, `.masonry`, `.drop-cap`.
- **Varied surfaces**: each post kind has its own treatment (dog-eared review, taped quote card, collage list cover, ruled-paper update, butter-note recommendation, stamped "read ✓"). This keeps the feed from looking like a grid of identical cards.
- **Bookshelf**: every collection of books renders through `BookshelfRow` (`src/components/book/bookshelf.tsx`). Books are CSS 3D boxes standing spine-out on oak planks; hover, keyboard focus or a first tap turns a book to show its cover. Spine colours are sampled from each cover's thumbnail on a canvas (`spine-colour.ts`; Open Library serves covers with CORS) and cached per session. Planks are one repeating layer per shelf (`.shelf-planks`), so every row gets a full-width plank.
- **Home bookcase** (`/home`, `src/components/shelf/home-shelves.tsx`): three shelves (Read, Reading, Want to read) in one oak case. Books move by drag and drop (`@dnd-kit/core`; mouse, and press-and-hold on touch) or the ⋯ menu under each book (`shelf-menu.tsx`). Moves call the existing `setShelfStatusAction`, so they update the reader's one `user_books` row; the UI is optimistic and rolls back on failure. The feed moved to `/activity`; old `/home?tab=` links redirect.
- **Shareable reviews**: `/u/<username>/reviews/<book-slug>` (route group `(share)`, no app shell) is a public magazine-style page with Open Graph/Twitter cards. `?r=<id>` pins one review when a reader reviewed a book more than once. `…/card?template=minimal|vintage|scrapbook|dark&format=portrait|og` renders share images with `next/og` (1080×1350 or 1200×630); only public reviews get images. Visibility is enforced by the store (RLS), so signed-out visitors only see public reviews.
- **Reviews** carry `likesCount`/`commentsCount` read from their post, which powers "Most liked" sorting on book pages and Popular reviews on Discover.
- **Marginalia (annotations)** extend the existing `quotes` table rather than adding a parallel one: a passage, page, thoughts (`commentary`), a highlight colour, tags, visibility, and drafts (migration `20261106000000_marginalia.sql`). Likes, comments, replies, bookmarks and reposts stay on the annotation's post, so there is still one social layer with one set of RLS policies, counters and notifications. Drafts are visible only to their author (RLS and the demo store), never get a post (a trigger enforces it), and can't be un-published. `/marginalia` lists annotation posts (`listMarginalia`: following / popular / recent, filterable by genre, book and tag); book pages and the profile Marginalia tab reuse it. `/quotes/[id]/card` renders share images in four templates and three sizes (post, story, wide).
- **Covers**: `BookCover` uses the Open Library cover and falls back to a typeset jacket derived from the title, so a missing cover still looks intentional.
- **Masonry**: CSS columns, which need no JS and survive streaming.
- **Accessibility**: skip link, native `<dialog>` for modals (focus trap, Esc), keyboard-operable half-star slider, `aria-pressed` on toggles, `aria-current` on navigation, visible focus rings, and `prefers-reduced-motion` respected.
- **Mobile**: sticky top bar, a bottom tab bar with a central "create" action, and dialogs that become bottom sheets.

## Signature features: status and extension points

| Feature | Status | Where it plugs in |
| --- | --- | --- |
| Reading compatibility | **Implemented** — `reading_compatibility()` RPC and demo equivalent, shown on profiles | Extend the scoring in one SQL function |
| Pass the book | **Implemented** — book page "Pass it on", inbox under Notifications | `recommendations` table |
| Book trails | **Data model + "pass it on" from a received pass** (sets `parent_id`) | A trail page is a recursive CTE over `recommendations.parent_id` |
| Reading Wrapped | **Reading year** page per profile, plus a quote-card image pipeline | Reuse the `next/og` route pattern in `app/quotes/[id]/card` for a year card |
| Suggested for you | **Implemented** — `/discover/for-you` and the top of Discover | See "Personalised suggestions" below |
| Little book clubs | Not built | Add `clubs`, `club_members` and `club_posts`, or give `posts` a `club_id` with a membership-based policy. `can_view` is the place to extend visibility |

## Personalised suggestions

Deterministic and metadata-only: no paid APIs, no LLM.

- **Engine** (`src/lib/suggestions/engine.ts`, pure): shelves → taste profile (authors, genres, Open Library subject headings, moods), each book weighted by shelf (Read 1, Reading 0.8, Want to Read 0.45, DNF 0), rating and favourite. Candidates score on topic overlap 30%, author 25%, closest single book's themes 20%, library breadth 15%, popularity 10% (`WEIGHTS`). Every explanation comes from the metadata that matched.
- **Discovery** (`discover.ts`, `sources.ts`): at most 4 subject + 3 author Open Library lookups (each cached a day), books loved by readers with overlapping shelves (`co_shelved_books()`), and catalogue genre matches. A failed lookup returns null and is counted, so a failure never reads as "nothing found".
- **Lifecycle** (`service.ts`, `trigger.ts`): a fingerprint of the shelves is stored with each list. Shelf actions schedule a rebuild with `after()`; opening the list rebuilds only if the fingerprint changed. A refresh claims itself first, then backs off for 45s after a failure, keeping the current list. Adding a book never waits on suggestions.
- **Storage**: `book_suggestions` (private per reader; dismissed/added rows are never touched by a refresh, so they never come back) and `suggestion_runs`, written atomically by `save_suggestions()`. `books.subjects` holds cleaned headings, filled server-side on add and backfilled a few per refresh. Separate from `recommendations`, which are books one reader passes to another.

## Known limitations

- Moods are curated on seeded books. Open Library has no mood data, so newly added books get genres (mapped from subjects) but no moods until reader tagging exists.
- Discover ranks posts by recency (public, not your own). An engagement-weighted ranking would need a materialised score so cursor pagination stays stable.
- Demo mode persists to the local filesystem; on read-only hosts it falls back to memory. It isn't for production.
