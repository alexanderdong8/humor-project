"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CaptionWriterError, writeCaptions } from "@/lib/ai/caption-writer";
import { fetchImage } from "@/lib/ai/fetch-image";
import {
  DAILY_POST_LIMIT,
  getPost,
  isMood,
  isVoice,
  MOODS,
  REMIX_CAPTIONS,
  REMIXES_PER_DAY,
  REMIXES_PER_POST,
} from "@/lib/battle";
import { getDailyTheme } from "@/lib/daily-theme";
import { getNextDuel, type Duel } from "@/lib/duels";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUCKET = "caption-photos";
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type CreatePostState = { error?: string };

export async function createPost(input: {
  path: string;
  voice: string;
  useTheme: boolean;
}): Promise<CreatePostState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in to post." };

  const discardUpload = () => supabase.storage.from(BUCKET).remove([input.path]);

  // Only accept photos the member just uploaded to their own folder.
  if (!new RegExp(`^${user.id}/[A-Za-z0-9-]+\\.(jpg|png|webp)$`).test(input.path)) {
    return { error: "That upload didn't look right. Please choose the photo again." };
  }
  if (!isVoice(input.voice)) {
    await discardUpload();
    return { error: "Pick a caption style." };
  }

  const { data: usedToday } = await supabase.rpc("my_generations_today");
  if ((usedToday ?? 0) >= DAILY_POST_LIMIT) {
    await discardUpload();
    return { error: `You've hit today's limit of ${DAILY_POST_LIMIT} posts. Come back tomorrow!` };
  }

  const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(input.path);
  if (downloadError || !file) {
    return { error: "We couldn't read your photo. Please try uploading it again." };
  }
  const mediaType = MEDIA_TYPES.find((t) => t === file.type) ?? "image/jpeg";
  const theme = input.useTheme ? (await getDailyTheme()).theme : null;

  let result: Awaited<ReturnType<typeof writeCaptions>>;
  try {
    result = await writeCaptions({
      image: { data: Buffer.from(await file.arrayBuffer()).toString("base64"), mediaType },
      voice: input.voice,
      theme,
    });
  } catch (error) {
    console.error("[battle] caption writer failed", error);
    await discardUpload();
    return {
      error: error instanceof CaptionWriterError ? error.userMessage : "Something went wrong writing your captions.",
    };
  }

  const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(input.path).data.publicUrl;
  const { data: post, error: postError } = await supabase
    .from("generations")
    .insert({
      image_path: input.path,
      image_url: imageUrl,
      theme,
      voice: input.voice,
      prompt: result.prompt,
      model: result.model,
    })
    .select("id")
    .single();

  if (postError || !post) {
    console.error("[battle] saving post failed", postError);
    await discardUpload();
    return { error: "We couldn't save your post. Please try again." };
  }

  const { error: captionsError } = await supabase.from("captions").insert(
    result.captions.map((text, i) => ({ generation_id: post.id, position: i + 1, text })),
  );
  if (captionsError) {
    console.error("[battle] saving captions failed", captionsError);
    await supabase.from("generations").delete().eq("id", post.id);
    await discardUpload();
    return { error: "We couldn't save your captions. Please try again." };
  }

  revalidatePath("/battle");
  redirect(`/battle/${post.id}?new=1`);
}

export type VoteResult =
  | { ok: true; upvotes: number; downvotes: number; myVote: 1 | -1 | 0 }
  | { ok: false; error: "signin" | "failed" };

/**
 * Cast, switch, or take back a vote. Voting the same way twice removes the
 * vote. Every change is a row in caption_votes; RLS ties it to the voter.
 */
export async function castVote(captionId: string, value: 1 | -1): Promise<VoteResult> {
  if (value !== 1 && value !== -1) return { ok: false, error: "failed" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "signin" };

  const { data: existing } = await supabase
    .from("caption_votes")
    .select("value")
    .eq("caption_id", captionId)
    .eq("user_id", user.id)
    .maybeSingle();

  const votes = supabase.from("caption_votes");
  let myVote: 1 | -1 | 0 = value;
  let error;
  if (existing?.value === value) {
    myVote = 0;
    ({ error } = await votes.delete().eq("caption_id", captionId).eq("user_id", user.id));
  } else if (existing) {
    ({ error } = await votes
      .update({ value, updated_at: new Date().toISOString() })
      .eq("caption_id", captionId)
      .eq("user_id", user.id));
  } else {
    ({ error } = await votes.insert({ caption_id: captionId, user_id: user.id, value }));
  }

  if (error) {
    console.error("[battle] vote failed", error);
    return { ok: false, error: "failed" };
  }

  const { data: caption } = await supabase
    .from("captions")
    .select("upvotes, downvotes")
    .eq("id", captionId)
    .single();

  return { ok: true, upvotes: caption?.upvotes ?? 0, downvotes: caption?.downvotes ?? 0, myVote };
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: post } = await supabase
    .from("generations")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id)
    .select("image_path")
    .maybeSingle();

  if (post) await supabase.storage.from(BUCKET).remove([post.image_path]);
  revalidatePath("/battle");
  redirect("/battle");
}

// ---------------------------------------------------------------------------
// Quick Vote: pick the funnier of two captions on the same photo.

export type DuelResult =
  | { ok: true; stats: Record<string, { wins: number; losses: number }>; next: Duel | null }
  | { ok: false; error: "signin" | "failed" };

/**
 * Saves one head-to-head pick as a row in caption_duels (RLS checks the pair
 * is from one post and not the judge's own), then returns both captions'
 * updated records and the next matchup.
 */
export async function judgeDuel(
  input: { postId: string; winner: string; loser: string },
  skip: string[] = [],
): Promise<DuelResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "signin" };
  if (![input.postId, input.winner, input.loser].every((id) => UUID.test(id)) || input.winner === input.loser) {
    return { ok: false, error: "failed" };
  }

  const [captionA, captionB] = [input.winner, input.loser].sort();
  const { error } = await supabase.from("caption_duels").insert({
    generation_id: input.postId,
    caption_a: captionA,
    caption_b: captionB,
    winner: input.winner,
  });
  // 23505: already judged this pair (e.g. a double tap); treat it as done.
  if (error && error.code !== "23505") {
    console.error("[battle] duel failed", error);
    return { ok: false, error: "failed" };
  }

  const [{ data: rows }, next] = await Promise.all([
    supabase.from("captions").select("id, duel_wins, duel_losses").in("id", [captionA, captionB]),
    getNextDuel(user.id, skip),
  ]);
  const stats = Object.fromEntries((rows ?? []).map((r) => [r.id, { wins: r.duel_wins, losses: r.duel_losses }]));
  return { ok: true, stats, next };
}

/** Skips the current matchup (the client passes every pair it has skipped). */
export async function skipDuel(skip: string[]): Promise<Duel | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getNextDuel(user.id, skip.filter((key) => /^[0-9a-f-]{36}:[0-9a-f-]{36}$/i.test(key)).slice(0, 200));
}

// ---------------------------------------------------------------------------
// Remix: more captions for a post, in a chosen mood.

export type RemixResult = { ok: true; added: number } | { ok: false; error: string };

export async function remixPost(postId: string, mood: string): Promise<RemixResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to remix captions." };
  if (!UUID.test(postId) || !isMood(mood)) return { ok: false, error: "That remix didn't make sense. Try again." };

  const post = await getPost(postId);
  if (!post) return { ok: false, error: "That post is gone." };

  const [{ data: postRemixes }, { data: myRemixes }] = await Promise.all([
    supabase.rpc("remix_count", { p_generation: postId }),
    supabase.rpc("my_remixes_today"),
  ]);
  if ((postRemixes ?? 0) >= REMIXES_PER_POST) {
    return { ok: false, error: `This post has been remixed the max ${REMIXES_PER_POST} times. Go vote on the results!` };
  }
  if ((myRemixes ?? 0) >= REMIXES_PER_DAY) {
    return { ok: false, error: `You've used all ${REMIXES_PER_DAY} remixes for today. Come back tomorrow!` };
  }

  let result: Awaited<ReturnType<typeof writeCaptions>>;
  try {
    const image = await fetchImage(post.image_url);
    result = await writeCaptions({
      image,
      voice: post.voice,
      theme: post.theme,
      mood,
      avoid: post.captions.map((c) => c.text),
      count: REMIX_CAPTIONS,
    });
  } catch (error) {
    console.error("[battle] remix failed", error);
    return {
      ok: false,
      error: error instanceof CaptionWriterError ? error.userMessage : "Couldn't remix that photo right now. Try again.",
    };
  }

  // The remix row (with its exact prompt) comes first; RLS enforces the limits again.
  const { data: remix, error: remixError } = await supabase
    .from("caption_remixes")
    .insert({ generation_id: postId, mood, prompt: result.prompt, model: result.model })
    .select("id")
    .single();
  if (remixError || !remix) {
    console.error("[battle] saving remix failed", remixError);
    return { ok: false, error: "Couldn't save your remix. You may have hit a limit." };
  }

  // Append after the post's last caption; retry once if someone remixed at the same moment.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: last } = await supabase
      .from("captions")
      .select("position")
      .eq("generation_id", postId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const start = (last?.position ?? 0) + 1;
    const { error } = await supabase.from("captions").insert(
      result.captions.map((text, i) => ({ generation_id: postId, position: start + i, text, remix_id: remix.id })),
    );
    if (!error) {
      revalidatePath(`/battle/${postId}`);
      return { ok: true, added: result.captions.length };
    }
    if (error.code !== "23505") {
      console.error("[battle] saving remix captions failed", error);
      break;
    }
  }
  return { ok: false, error: `Couldn't add your ${MOODS[mood].label.toLowerCase()} captions. Try again.` };
}
