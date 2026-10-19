import type { CaptionImage } from "@/lib/ai/caption-writer";
import { supabaseUrl } from "@/lib/supabase/env";

export const BOT_USER_AGENT = "PunchlineBot/1.0 (+https://hello-world-humor-project-seven.vercel.app)";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Only our own storage and the open-license photo hosts the daily post uses. */
const ALLOWED_HOSTS = [
  new URL(supabaseUrl).hostname,
  "upload.wikimedia.org",
  "api.openverse.org",
  "i.imgflip.com",
];

function isAllowed(url: URL) {
  return (
    url.protocol === "https:" &&
    (ALLOWED_HOSTS.includes(url.hostname) || url.hostname === "staticflickr.com" || url.hostname.endsWith(".staticflickr.com"))
  );
}

/** Downloads a photo for the model, refusing unknown hosts, odd formats, and huge files. */
export async function fetchImage(rawUrl: string, maxBytes = 6 * 1024 * 1024): Promise<CaptionImage> {
  const url = new URL(rawUrl);
  if (!isAllowed(url)) throw new Error(`image host not allowed: ${url.hostname}`);

  // Uses the runtime's standard user agent: Flickr's CDN rejects Node requests
  // that send a custom one (403), but serves them with the default.
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`image responded ${res.status}`);

  const mediaType = MEDIA_TYPES.find((t) => t === res.headers.get("content-type")?.split(";")[0].trim());
  if (!mediaType) throw new Error(`unsupported image type: ${res.headers.get("content-type")}`);

  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error(`image too large: ${bytes.byteLength} bytes`);
  return { data: Buffer.from(bytes).toString("base64"), mediaType };
}
