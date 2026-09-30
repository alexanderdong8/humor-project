# Punchline

A small, hand-picked joke library with Google sign-in and a members-only "Green Room".
Built with Next.js 16 (App Router) and Supabase (Postgres, Auth, Storage), deployed on Vercel.

## Features

- **Library** (`/jokes`): every joke, filterable by category and paginated 9 per page. Punchlines stay hidden until you tap the card.
- **Joke of the day** on the home page, the same for every visitor on a given day.
- **Google sign-in** via Supabase Auth. New users get a `profiles` row from a database trigger and are asked for their name before entering.
- **Profile** (`/profile`): edit first and last name and a favorite category, and upload a photo to Supabase Storage.
- **Green Room** (`/members`): members-only picks based on your favorite category. Signed-out visitors are redirected to `/login`.

## Local development

1. Install dependencies: `npm install`
2. Create `.env` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable or anon key>
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

## Auth setup

- **Google Cloud:** create an OAuth client (Web application) with the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Supabase → Authentication → Providers → Google:** paste the client ID and secret.
- **Supabase → Authentication → URL Configuration:** set the Site URL to the production domain, and allow `http://localhost:3000/auth/callback` plus `https://<your-vercel-project>-*.vercel.app/auth/callback`.

## Deploying

Set both `NEXT_PUBLIC_SUPABASE_*` variables in the Vercel project for every environment, then run `vercel deploy --prod`. Git pushes also deploy automatically once the repository is connected in Vercel.
