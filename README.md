# Punchline

A small, hand-picked joke library with Google sign-in and a members-only "Green Room".
Built with Next.js 16 (App Router) and Supabase (Postgres, Auth, Storage), deployed on Vercel.

## Features

- **Library** (`/jokes`): every joke, filterable by category and paginated 9 per page. Punchlines stay hidden until you tap the card.
- **Joke of the day** on the home page, the same for every visitor on a given day.
- **Google sign-in** via Supabase Auth. New users get a `profiles` row from a database trigger and are asked for their name before entering.
- **Profile** (`/profile`): edit first and last name and a favorite category, and upload a photo to Supabase Storage.
- **Caption Battle** (`/battle`): members upload a photo, pick a caption style (Group chat, Sarcastic, Wholesome, Dramatic), and Google Gemini writes four captions. Everyone can browse; signed-in members vote each caption up or down. A new theme every day, and the "Today's top" board resets at midnight Eastern. Each post has a shareable page.
- **Green Room** (`/members`): members-only picks based on your favorite category. Signed-out visitors are redirected to `/login`.

## Local development

1. Install dependencies: `npm install`
2. Create `.env` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable or anon key>
   GEMINI_API_KEY=<key from aistudio.google.com/apikey>
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
| `supabase/captions.sql` | `generations`, `captions`, `caption_votes` tables, vote-tally and author triggers, strict RLS, `caption-photos` Storage bucket |

## Auth setup

- **Google Cloud:** create an OAuth client (Web application) with the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Supabase → Authentication → Providers → Google:** paste the client ID and secret.
- **Supabase → Authentication → URL Configuration:** set the Site URL to the production domain, and allow `http://localhost:3000/auth/callback` plus `https://<your-vercel-project>-*.vercel.app/auth/callback`.

## AI captions

Captions come from Google Gemini (`gemini-3.5-flash`, falling back to `gemini-3.8-flash` and `gemini-3.5-flash-lite` when a model is busy) through the official `@google/genai` SDK. Set `GEMINI_API_KEY` in `.env` and in the Vercel project. It is read only on the server and never exposed to the browser.

Every post stores the exact text prompt sent to the model (`generations.prompt`) and the model id. Photos live in Supabase Storage, never in Postgres. Members can post 10 times per 24 hours, enforced by RLS.

## Row level security

RLS is on for every table. Anyone can read jokes, posts, and captions. Members can only read and edit their own profile, create posts under their own id (10 per day), add captions to their own new post, and see or change their own votes. Vote tallies and post authors are written by triggers, so they can't be spoofed from the client.

## Deploying

Set both `NEXT_PUBLIC_SUPABASE_*` variables and `GEMINI_API_KEY` in the Vercel project for every environment, then run `vercel deploy --prod`. Git pushes also deploy automatically once the repository is connected in Vercel.
