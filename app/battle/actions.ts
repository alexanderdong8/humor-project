"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CaptionWriterError, writeCaptions } from "@/lib/ai/caption-writer";
import { DAILY_POST_LIMIT, isVoice, themeForDate } from "@/lib/battle";
import { createClient } from "@/lib/supabase/server";

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
    return { error: "Pick a voice for your captions." };
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
  const theme = input.useTheme ? themeForDate() : null;

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
