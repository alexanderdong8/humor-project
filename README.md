# Punchline

A small, hand-picked joke library with Google sign-in and a members-only "Green Room".
Built with Next.js 16 (App Router) and Supabase (Postgres, Auth, Storage), deployed on Vercel.

## Features

- **Library** (`/jokes`): every joke, filterable by category and paginated 9 per page. Punchlines stay hidden until you tap the card.
- **Joke of the day** on the home page, the same for every visitor on a given day.
- **Google sign-in** via Supabase Auth. New users get a `profiles` row from a database trigger and are asked for their name before entering.
- **Profile** (`/profile`): edit first and last name and a favorite category, and upload a photo to Supabase Storage.
- **Post a photo** (`/post/new` → `/post/[id]/pick`): upload a photo and pick a caption style (Group chat, Sarcastic, Wholesome, Dramatic); Google Gemini writes 4 captions. The post stays a private draft while you knock the captions out in a bracket (two semifinals and a final). The winner becomes the photo's **only** caption and the post goes live; the losing captions are deleted.
- **Battle** (`/battle`), the one community vote: two posts (photo + caption) side by side; tap the funnier (← / → work too). Every pick is a row in `post_battles` and updates both posts' win/loss records. Members never judge their own posts or the same matchup twice. A new theme every day, generated from what's trending in New York (X trends when reachable, otherwise Google's trending searches).
- **Leaderboard** (`/top`): browse-only rankings by battle record (Today / This week / All-time). Voting only happens in Battle.
- **Daily AI Meme** (`/daily`): each night the AI picks a meme template from Imgflip's 100 most popular for the day's theme and writes 4 captions in that meme's format. Members battle its captions two at a time (rows in `caption_duels`) and see live standings, plus yesterday's winner. It lives on its own route, separate from member posts.
- **Remix** (post page, owner only): get 3 new captions that are 😈 Meaner, 😂 Funnier, or 🫠 Relatable, then battle them against your current caption. The winner stays and the rest are deleted, so a photo never has more than 4 captions (enforced by a database trigger). Remixes aren't capped per photo; each member gets 20 a day. Each remix and its prompt are saved in `caption_remixes`.
- **Green Room** (`/members`): your home base, with a "What is the Green Room?" help panel, a joke set you tune by tapping a favorite category (saves instantly), all your posts with their battle records (and drafts waiting for a caption), and shortcuts. Signed-out visitors are redirected to `/login`.

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
| `supabase/quick_vote_remix_daily.sql` | `caption_duels` and `caption_remixes` tables, head-to-head tallies in each caption's score, daily AI posts (`kind = 'daily'`), and their RLS |
| `supabase/battles_v2.sql` | Drafts and one chosen caption per post, the 4-caption cap, `post_battles` (the community vote) with win/loss records, owner-only remix, caption duels limited to the daily meme, and the updated signed-out preview |
| `supabase/captions.sql` | `generations`, `captions`, `caption_votes` tables, vote-tally and author triggers, strict RLS, `caption-photos` Storage bucket |

## Auth setup

- **Google Cloud:** create an OAuth client (Web application) with the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Supabase → Authentication → Providers → Google:** paste the client ID and secret.
- **Supabase → Authentication → URL Configuration:** set the Site URL to the production domain, and allow `http://localhost:3000/auth/callback` plus `https://<your-vercel-project>-*.vercel.app/auth/callback`.

## AI captions

Captions come from Google Gemini (`gemini-3.5-flash`, falling back to `gemini-3.8-flash` and `gemini-3.5-flash-lite` when a model is busy) through the official `@google/genai` SDK. Set `GEMINI_API_KEY` in `.env` and in the Vercel project. It is read only on the server and never exposed to the browser.

Every post stores the exact text prompt sent to the model (`generations.prompt`) and the model id. Photos live in Supabase Storage, never in Postgres. Members can post 10 times per 24 hours, enforced by RLS.

## Daily theme from X trends

A Vercel Cron job (`vercel.json`, 05:10 UTC, just after midnight Eastern) calls `/api/cron/daily-theme`. It scrapes the last 24 hours of X trending topics for New York from trends24.in (which republishes X's hourly lists and allows crawling), ranks them by how long and how high they trended, and asks Gemini to turn one into a safe, photographable theme, skipping tragedies, politics, and real people. If X trends can't be fetched (trends24 returns 403 to cloud servers, including Vercel's) it uses Google Trends' trending-searches RSS for New York, then the US, and the page labels the source accordingly, and if nothing is usable it falls back to a built-in rotation. The theme, the trend that inspired it, the full trend list, the prompt, and the model are stored in `daily_themes`. If a page is visited before the job runs, the theme is generated in the background right after that response.

The same job then creates the daily AI meme (see Features) from an Imgflip template. Image generation isn't available on the free Gemini tier, so the AI picks a classic meme template instead of drawing one.

The job writes through `THEME_WRITER_DB_URL`, a Postgres login (`theme_writer`) that can only write `daily_themes` and create the daily AI post and its captions, and only runs when called with `CRON_SECRET`.

## Members vs. visitors

Signed-out visitors can't read posts or captions directly (RLS). They see a preview from the `battle_preview` database function: at most 3 published posts with their caption, and today's daily meme with its leading caption. The joke library shows them the first page of each category. Battling, posting, remixing, the full leaderboard, all four daily-meme captions, and the Green Room require signing in.

## Row level security

RLS is on for every table. Anyone can read jokes and the daily theme. Members see published posts, but only each post's chosen caption (plus their own drafts and candidates). Members can only edit their own profile, create posts under their own id (10 per day), pick and publish their own post's caption, delete their own losing captions, remix only their own posts, and see their own battle and duel picks. Battle records, caption tallies, and post authors are written by triggers, and members can't update any other post column, so none of it can be spoofed from the client. A photo can never have more than 4 captions.

## Deploying

Set both `NEXT_PUBLIC_SUPABASE_*` variables and `GEMINI_API_KEY` in the Vercel project for every environment, then run `vercel deploy --prod`. Git pushes also deploy automatically once the repository is connected in Vercel.
