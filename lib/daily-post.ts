import { GoogleGenAI } from "@google/genai";
import pg from "pg";
import { MODELS, writeCaptions, type CaptionImage } from "@/lib/ai/caption-writer";
import { BOT_USER_AGENT, fetchImage } from "@/lib/ai/fetch-image";
import { VOICES, type VoiceId } from "@/lib/battle";
import type { DailyTheme } from "@/lib/daily-theme";

/**
 * The daily AI post: every day the AI finds an openly licensed photo that fits
 * the theme (via Openverse, from Flickr and Wikimedia Commons), picks the
 * funniest safe one by looking at the candidates, and writes four captions.
 * It's posted as "Punchline AI" so there's always something to vote on.
 */

type OpenverseImage = {
  id: string;
  title: string | null;
  url: string;
  thumbnail: string;
  creator: string | null;
  license: string;
  license_version: string | null;
  foreign_landing_url: string | null;
  width: number | null;
  height: number | null;
};

const SEARCH_PROMPT = `You help run Caption Battle, a game where Columbia students in New York vote on funny captions for a photo.
Given today's theme, suggest 4 short image-search queries (1 to 3 words each) for finding a real photo that would be funny to caption.
Prefer animals, food, objects, signs of everyday chaos, and city or campus scenes over photos of people.
Avoid anything sad, violent, political, medical, or about real named people.`;

const PICK_PROMPT = `You're choosing today's photo for Caption Battle, where Columbia students in New York vote on funny captions.
Rank the numbered photos from best to worst for being fun to caption for today's theme. Leave out any photo that is:
- not a real photo (diagrams, logos, maps, screenshots, mostly text)
- unsafe for work, sad, disturbing, or about a tragedy
- focused on an identifiable person's face
Return only the numbers of suitable photos, best first.`;

function geminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

/** Runs a JSON-returning Gemini call, falling back through the model list. */
async function askJson<T>(contents: Parameters<GoogleGenAI["models"]["generateContent"]>[0]["contents"], system: string, schema: object) {
  const ai = geminiClient();
  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: schema },
      });
      return { data: JSON.parse(res.text ?? "{}") as T, model };
    } catch (error) {
      console.warn(`[daily-post] ${model} failed, trying the next model`, error);
      lastError = error;
    }
  }
  throw lastError;
}

async function searchOpenverse(query: string): Promise<OpenverseImage[]> {
  const params = new URLSearchParams({ q: query, page_size: "8", mature: "false", source: "flickr,wikimedia" });
  const res = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
    headers: { "user-agent": BOT_USER_AGENT },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`openverse responded ${res.status}`);
  const body = (await res.json()) as { results?: OpenverseImage[] };
  return (body.results ?? []).filter(
    (r) => r.url && r.thumbnail && (r.width ?? 0) >= 600 && (r.height ?? 0) >= 400,
  );
}

function formatLicense(license: string, version: string | null) {
  if (license === "cc0") return "CC0";
  if (license === "pdm") return "Public domain";
  return `CC ${license.toUpperCase()}${version ? ` ${version}` : ""}`;
}

function credit(photo: OpenverseImage) {
  const title = photo.title?.trim() ? `“${photo.title.trim().slice(0, 80)}”` : "Photo";
  const by = photo.creator?.trim() ? ` by ${photo.creator.trim().slice(0, 60)}` : "";
  return `${title}${by} · ${formatLicense(photo.license, photo.license_version)}`;
}

/** Same voice rotation for everyone on a given day. */
function voiceForDay(day: string): VoiceId {
  const voices = Object.keys(VOICES) as VoiceId[];
  return voices[Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000) % voices.length];
}

/** Creates today's AI photo post if it doesn't exist yet. Returns its id, or null if no photo worked. */
export async function generateDailyPost(day: string, theme: Pick<DailyTheme, "theme" | "idea">) {
  const url = process.env.THEME_WRITER_DB_URL;
  if (!url) throw new Error("THEME_WRITER_DB_URL is not set");

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const existing = await client.query("select id from public.generations where daily_for = $1", [day]);
    if (existing.rows[0]) return existing.rows[0].id as string;

    // 1. Search ideas for the theme.
    const { data: search } = await askJson<{ queries?: string[] }>(
      `Today's theme: "${theme.theme}". ${theme.idea ?? ""}`,
      SEARCH_PROMPT,
      { type: "object", properties: { queries: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } }, required: ["queries"] },
    );
    const queries = (search.queries ?? []).map((q) => q.trim()).filter(Boolean).slice(0, 4);
    if (queries.length === 0) queries.push(theme.theme);

    // 2. Openly licensed candidates from Flickr and Wikimedia Commons.
    const results = (await Promise.all(queries.map((q) => searchOpenverse(q).catch(() => [])))).flat();
    const unique = [...new Map(results.map((r) => [r.id, r])).values()].slice(0, 12);

    // 3. Thumbnails, so the model can look at the options.
    const thumbs = await Promise.all(
      unique.map(async (photo) => {
        try {
          return { photo, image: await fetchImage(photo.thumbnail, 1.5 * 1024 * 1024) };
        } catch {
          return null;
        }
      }),
    );
    const candidates = thumbs.filter((t): t is { photo: OpenverseImage; image: CaptionImage } => t !== null).slice(0, 10);
    if (candidates.length === 0) {
      console.error("[daily-post] no usable photos for", queries);
      return null;
    }

    // 4. Let the model pick the funniest safe photo.
    const parts = candidates.flatMap((c, i) => [
      { text: `Photo ${i + 1}:` },
      { inlineData: { mimeType: c.image.mediaType, data: c.image.data } },
    ]);
    const { data: pick, model: pickModel } = await askJson<{ ranking?: number[] }>(
      [{ role: "user", parts: [{ text: `Today's theme: "${theme.theme}".` }, ...parts] }],
      PICK_PROMPT,
      { type: "object", properties: { ranking: { type: "array", items: { type: "integer" } } }, required: ["ranking"] },
    );
    const ranked = (pick.ranking ?? [])
      .map((n) => candidates[n - 1])
      .filter((c): c is (typeof candidates)[number] => Boolean(c));
    const chosen = ranked[0];
    if (!chosen) {
      console.error("[daily-post] the model found no suitable photo among", candidates.length);
      return null;
    }

    // 5. Captions for the chosen photo (the thumbnail is plenty for the model).
    const voice = voiceForDay(day);
    const result = await writeCaptions({ image: chosen.image, voice, theme: theme.theme });
    const prompt = [
      result.prompt,
      "",
      "[photo selection]",
      `Search queries: ${queries.join(", ")}`,
      `Picked Openverse image ${chosen.photo.id} from ${candidates.length} candidates (${pickModel}).`,
    ].join("\n");

    // 6. Save the post and its captions as one transaction.
    await client.query("begin");
    try {
      const { rows } = await client.query(
        `insert into public.generations
           (kind, daily_for, image_path, image_url, theme, voice, prompt, model, photo_credit, photo_source_url, author_name)
         values ('daily', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'Punchline AI')
         returning id`,
        [
          day,
          `openverse:${chosen.photo.id}`,
          chosen.photo.url,
          theme.theme,
          voice,
          prompt,
          result.model,
          credit(chosen.photo),
          chosen.photo.foreign_landing_url,
        ],
      );
      const postId = rows[0].id as string;
      for (const [i, text] of result.captions.entries()) {
        await client.query("insert into public.captions (generation_id, position, text) values ($1, $2, $3)", [
          postId,
          i + 1,
          text,
        ]);
      }
      await client.query("commit");
      return postId;
    } catch (error) {
      await client.query("rollback");
      // Another run created today's post first.
      if ((error as { code?: string }).code === "23505") {
        const again = await client.query("select id from public.generations where daily_for = $1", [day]);
        return (again.rows[0]?.id as string | undefined) ?? null;
      }
      throw error;
    }
  } finally {
    await client.end();
  }
}
