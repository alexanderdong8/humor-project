import { GoogleGenAI } from "@google/genai";
import pg from "pg";
import { MODELS, writeCaptions } from "@/lib/ai/caption-writer";
import { BOT_USER_AGENT, fetchImage } from "@/lib/ai/fetch-image";
import { VOICES, type VoiceId } from "@/lib/battle";
import type { DailyTheme } from "@/lib/daily-theme";

/**
 * The daily AI meme: every day the AI picks a meme template from Imgflip's
 * 100 most popular (Drake, Distracted Boyfriend, Two Buttons...) that fits the
 * theme, then writes four captions for it in that meme's usual format. It's
 * posted as "Punchline AI" at /daily, where members battle its captions.
 */

type MemeTemplate = { id: string; name: string; url: string; width: number; height: number; box_count: number };

const PICK_PROMPT = `You pick the meme template for Punchline's Daily AI Meme, where Columbia students in New York vote on which AI-written caption is funniest.
Given today's theme and a list of popular meme templates, choose the ONE template that will make the funniest captions about the theme.
Prefer templates people instantly recognize and that work with a single caption (reaction images and two-option formats are great).
Avoid templates that depend on a specific real person's identity, or that are hard to caption in one line.`;

/** Skip templates used this recently so the daily meme doesn't repeat. */
const REUSE_AFTER_DAYS = 45;

function geminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

async function getMemeTemplates(): Promise<MemeTemplate[]> {
  const res = await fetch("https://api.imgflip.com/get_memes", {
    headers: { "user-agent": BOT_USER_AGENT },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`imgflip responded ${res.status}`);
  const body = (await res.json()) as { success?: boolean; data?: { memes?: MemeTemplate[] } };
  if (!body.success) throw new Error("imgflip returned no memes");
  return (body.data?.memes ?? []).filter((m) => m.url.startsWith("https://i.imgflip.com/") && m.width >= 300);
}

/** Asks Gemini which template fits today's theme, falling back through the model list. */
async function chooseTemplate(templates: MemeTemplate[], theme: Pick<DailyTheme, "theme" | "idea">) {
  const ai = geminiClient();
  const list = templates.map((t) => `${t.id} | ${t.name}`).join("\n");
  const contents = `Today's theme: "${theme.theme}". ${theme.idea ?? ""}\n\nTemplates (id | name):\n${list}`;
  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: PICK_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
        },
      });
      const { id } = JSON.parse(res.text ?? "{}") as { id?: string };
      const template = templates.find((t) => t.id === id?.trim());
      if (template) return { template, model, prompt: `[system]\n${PICK_PROMPT}\n\n[user]\n${contents}` };
      lastError = new Error(`${model} picked an unknown template: ${id}`);
    } catch (error) {
      console.warn(`[daily-post] ${model} failed, trying the next model`, error);
      lastError = error;
    }
  }
  throw lastError;
}

/** Same voice rotation for everyone on a given day. */
function voiceForDay(day: string): VoiceId {
  const voices = Object.keys(VOICES) as VoiceId[];
  return voices[Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000) % voices.length];
}

/**
 * Picks and captions today's meme without saving anything. Used by
 * generateDailyPost, and on its own for the cron job's dry run.
 */
export async function buildDailyPost(
  day: string,
  theme: Pick<DailyTheme, "theme" | "idea">,
  recentlyUsed: Set<string> = new Set(),
) {
  const all = await getMemeTemplates();
  const fresh = all.filter((t) => !recentlyUsed.has(t.id));
  const { template, model: pickModel, prompt: pickPrompt } = await chooseTemplate(fresh.length > 0 ? fresh : all, theme);

  const voice = voiceForDay(day);
  const image = await fetchImage(template.url);
  const result = await writeCaptions({
    image,
    voice,
    theme: theme.theme,
    context: `This image is the "${template.name}" meme template. Write captions the way people caption this meme (its usual format and joke structure), applied to the theme. Each caption is a single line shown under the image.`,
  });

  const prompt = [
    result.prompt,
    "",
    "[template selection]",
    pickPrompt,
    "",
    `Picked Imgflip template ${template.id} (${template.name}) with ${pickModel}.`,
  ].join("\n");

  return { template, voice, captions: result.captions, model: result.model, prompt };
}

/** Creates today's AI meme post if it doesn't exist yet. Returns its id. */
export async function generateDailyPost(day: string, theme: Pick<DailyTheme, "theme" | "idea">) {
  const url = process.env.THEME_WRITER_DB_URL;
  if (!url) throw new Error("THEME_WRITER_DB_URL is not set");

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const existing = await client.query("select id from public.generations where daily_for = $1", [day]);
    if (existing.rows[0]) return existing.rows[0].id as string;

    const recent = await client.query(
      `select image_path from public.generations
        where kind = 'daily' and image_path like 'imgflip:%' and daily_for > ($1::date - $2::int)`,
      [day, REUSE_AFTER_DAYS],
    );
    const recentlyUsed = new Set(recent.rows.map((r) => String(r.image_path).slice("imgflip:".length)));
    const { template, voice, captions, model, prompt } = await buildDailyPost(day, theme, recentlyUsed);

    // Save the post and its captions as one transaction.
    await client.query("begin");
    try {
      const { rows } = await client.query(
        `insert into public.generations
           (kind, daily_for, image_path, image_url, theme, voice, prompt, model, photo_credit, photo_source_url, author_name)
         values ('daily', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'Punchline AI')
         returning id`,
        [
          day,
          `imgflip:${template.id}`,
          template.url,
          theme.theme,
          voice,
          prompt,
          model,
          `“${template.name}” meme template · via Imgflip`,
          `https://imgflip.com/memetemplate/${template.id}`,
        ],
      );
      const postId = rows[0].id as string;
      for (const [i, text] of captions.entries()) {
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
