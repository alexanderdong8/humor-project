# Punchline

A small, hand-picked joke library with Google sign-in and a members-only "Green Room".
Built with Next.js 16 (App Router) and Supabase (Postgres, Auth, Storage), deployed on Vercel.

## Features

- **Library** (`/jokes`): every joke, filterable by category and paginated 9 per page. Punchlines stay hidden until you tap the card.
- **Joke of the day** on the home page, the same for every visitor on a given day.
- **Google sign-in** via Supabase Auth. New users get a `profiles` row from a database trigger and are asked for their name before entering.
- **Profile** (`/profile`): edit first and last name and a favorite category, and upload a photo to Supabase Storage.
- **Caption Battle** (`/battle`): members upload a photo, pick a caption style (Group chat, Sarcastic, Wholesome, Dramatic), and Google Gemini writes four captions. Everyone can browse; signed-in members vote each caption up or down. A new theme every day, generated from what's trending on X in New York, and the "Today's top" board resets at midnight Eastern. Each post has a shareable page.
- **Green Room** (`/members`): members-only picks based on your favorite category. Signed-out visitors are redirected to `/login`.

## Local development

1. Install dependencies: `npm install`
2. Create `.env` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable or anon key>
   GEMINI_API_KEY=<key from aistudio.google.com/apikey>
   THEME_WRITER_DB_URL=postgresql://theme_writer.<project-ref>:<password>@<pooler-host>:5432/postgres
   CRON_SECRET=<random string>
   ```
3. Run `npm run dev` and open http://localhost:3000

## Database

Run these in the Supabase SQL Editor, in order. Each one is safe to re-run except the seed inserts.

| File | What it does |
| --- | --- |
| `supabase/schema.sql` | `jokes` table, public read policy, starter jokes |
| `supabase/seed_more.sql` | More jokes |
| `supabase/auth_profiles.sql` | `profiles` table, `on_auth_user_created` trigger, owner-only RLS, `avatars` Storage bucket |
| `supabase/joke_categories.sql` | `joke_categories` view (category counts) |
| `supabase/battle_gating.sql` | Members-only reads for posts and captions, plus the `battle_preview` function signed-out visitors use |
| `supabase/daily_themes.sql` | `daily_themes` table and the write-only `theme_writer` role's access |
| `supabase/captions.sql` | `generations`, `captions`, `caption_votes` tables, vote-tally and author triggers, strict RLS, `caption-photos` Storage bucket |

## Auth setup

- **Google Cloud:** create an OAuth client (Web application) with the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Supabase → Authentication → Providers → Google:** paste the client ID and secret.
- **Supabase → Authentication → URL Configuration:** set the Site URL to the production domain, and allow `http://localhost:3000/auth/callback` plus `https://<your-vercel-project>-*.vercel.app/auth/callback`.

## AI captions

Captions come from Google Gemini (`gemini-3.5-flash`, falling back to `gemini-3.8-flash` and `gemini-3.5-flash-lite` when a model is busy) through the official `@google/genai` SDK. Set `GEMINI_API_KEY` in `.env` and in the Vercel project. It is read only on the server and never exposed to the browser.

Every post stores the exact text prompt sent to the model (`generations.prompt`) and the model id. Photos live in Supabase Storage, never in Postgres. Members can post 10 times per 24 hours, enforced by RLS.

## Daily theme from X trends

A Vercel Cron job (`vercel.json`, 05:10 UTC, just after midnight Eastern) calls `/api/cron/daily-theme`. It scrapes the last 24 hours of X trending topics for New York from trends24.in (which republishes X's hourly lists and allows crawling), ranks them by how long and how high they trended, and asks Gemini to turn one into a safe, photographable theme, skipping tragedies, politics, and real people. If X trends can't be fetched it uses Google Trends' daily RSS feed, and if nothing is usable it falls back to a built-in rotation. The theme, the trend that inspired it, the full trend list, the prompt, and the model are stored in `daily_themes`. If a page is visited before the job runs, the theme is generated in the background right after that response.

The job writes through `THEME_WRITER_DB_URL`, a Postgres login (`theme_writer`) that can only read and write `daily_themes`, and only runs when called with `CRON_SECRET`.

## Members vs. visitors

Signed-out visitors can't read posts or captions at all (RLS). They see a preview from the `battle_preview` database function: at most 3 posts, each with only its winning caption and a count of the hidden ones. The joke library shows them the first page of each category. Voting, posting, every caption, live scores, all pages of the library, and the Green Room require signing in.

## Row level security

RLS is on for every table. Anyone can read jokes and the daily theme; only members can read posts and captions. Members can only read and edit their own profile, create posts under their own id (10 per day), add captions to their own new post, and see or change their own votes. Vote tallies and post authors are written by triggers, so they can't be spoofed from the client.

## Deploying

Set both `NEXT_PUBLIC_SUPABASE_*` variables and `GEMINI_API_KEY` in the Vercel project for every environment, then run `vercel deploy --prod`. Git pushes also deploy automatically once the repository is connected in Vercel.
