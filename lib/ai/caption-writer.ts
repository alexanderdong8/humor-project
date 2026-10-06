import Anthropic from "@anthropic-ai/sdk";
import { getVercelOidcToken } from "@vercel/oidc";
import { VOICES, type VoiceId } from "@/lib/battle";

/** Claude Haiku 4.5 through the Vercel AI Gateway: fast, cheap, and good with photos. */
export const CAPTION_MODEL = "anthropic/claude-haiku-4.5";

const SYSTEM_PROMPT = `You are the head writer at Punchline, a comedy site for college students in New York City. Members upload a photo and you write captions that make them laugh out loud and want to send the post to their group chat.

Audience: Columbia undergrads who are chronically online, many of them new to New York, living in the dorms and exploring the city on weekends. Campus life, the subway, bodegas, dorms, dining halls, and being new to the city all land well.

Write exactly 4 captions for the photo. Each caption:
- reacts to what is actually in the photo; specific details beat generic jokes
- takes a different comedic angle from the others (an observation, an exaggeration, a relatable confession, an absurd twist)
- is one or two short sentences, under 120 characters
- stands on its own: no numbering, surrounding quotation marks, or hashtags

Keep it PG-13 and punch up, never down. Don't joke about anyone's body, looks, race, ethnicity, religion, gender, sexuality, disability, or age, and don't identify or guess who real people in the photo are. If people are in the photo, joke about the situation, not the person.

Submit the captions with the submit_captions tool.`;

const SUBMIT_TOOL: Anthropic.Tool = {
  name: "submit_captions",
  description: "Submit the four finished captions for the photo.",
  input_schema: {
    type: "object",
    properties: {
      captions: {
        type: "array",
        items: { type: "string", maxLength: 160 },
        minItems: 4,
        maxItems: 4,
      },
    },
    required: ["captions"],
    additionalProperties: false,
  },
};

export class CaptionWriterError extends Error {
  constructor(
    message: string,
    readonly userMessage: string,
  ) {
    super(message);
  }
}

async function gatewayClient() {
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? (await getVercelOidcToken());
  return new Anthropic({ apiKey, baseURL: "https://ai-gateway.vercel.sh", maxRetries: 1, timeout: 45_000 });
}

function userInstructions(voice: VoiceId, theme: string | null) {
  return [
    `Voice: ${VOICES[voice].label}. ${VOICES[voice].prompt}`,
    theme
      ? `Today's theme: "${theme}". Lean into it when the photo fits; never force it.`
      : "No theme today; caption whatever is in the photo.",
  ].join("\n");
}

type Input = {
  image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };
  voice: VoiceId;
  theme: string | null;
};

/**
 * Writes four captions for a photo. Returns them with the exact text prompt
 * that was sent (the photo itself is stored separately), so both can be saved.
 */
export async function writeCaptions({ image, voice, theme }: Input) {
  const instructions = userInstructions(voice, theme);
  const client = await gatewayClient();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: CAPTION_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_TOOL],
      tool_choice: { type: "tool", name: SUBMIT_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
            { type: "text", text: instructions },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new CaptionWriterError("rate limited", "The writers' room is slammed. Try again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new CaptionWriterError(
        `gateway ${error.status}: ${error.message}`,
        "Our caption writer is offline right now. Please try again later.",
      );
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new CaptionWriterError("model refused", "We can't caption that photo. Try a different one.");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === SUBMIT_TOOL.name,
  );
  const raw = (toolUse?.input as { captions?: unknown } | undefined)?.captions;
  const captions = Array.isArray(raw)
    ? [...new Set(raw.filter((c): c is string => typeof c === "string").map((c) => c.trim().replace(/^["“]|["”]$/g, "")))]
        .filter(Boolean)
        .map((c) => c.slice(0, 280))
        .slice(0, 4)
    : [];

  if (captions.length === 0) {
    throw new CaptionWriterError("no captions in response", "The jokes didn't come through. Please try again.");
  }

  return {
    captions,
    model: CAPTION_MODEL,
    prompt: `[system]\n${SYSTEM_PROMPT}\n\n[user]\n<photo>\n${instructions}`,
  };
}
