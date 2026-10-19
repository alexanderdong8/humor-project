"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CaptionWriterError, writeCaptions } from "@/lib/ai/caption-writer";
import { fetchImage } from "@/lib/ai/fetch-image";
import {
  chosenCaption,
  DAILY_POST_LIMIT,
  getPost,
  isMood,
  isVoice,
  MOODS,
  REMIX_CAPTIONS,
  REMIXES_PER_DAY,
} from "@/lib/battle";
import { getDailyTheme } from "@/lib/daily-theme";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "caption-photos";
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreatePostState = { error?: string };

/**
 * Step 1 of posting: the AI writes 4 candidate captions and the post is saved
 * as a private draft. The member then picks their caption in a bracket.
 */
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
    console.error("[post] caption writer failed", error);
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
    console.error("[post] saving post failed", postError);
    await discardUpload();
    return { error: "We couldn't save your post. Please try again." };
  }

  const { error: captionsError } = await supabase.from("captions").insert(
    result.captions.map((text, i) => ({ generation_id: post.id, position: i + 1, text })),
  );
  if (captionsError) {
    console.error("[post] saving captions failed", captionsError);
    await supabase.from("generations").delete().eq("id", post.id);
    await discardUpload();
    return { error: "We couldn't save your captions. Please try again." };
  }

  redirect(`/post/${post.id}/pick`);
}

export type ChooseResult = { error: string };

/**
 * The end of a caption bracket: the winner becomes the photo's one caption
 * (publishing the post if it was a draft) and the losing captions are deleted.
 */
export async function chooseCaption(postId: string, captionId: string): Promise<ChooseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in." };
  if (!UUID.test(postId) || !UUID.test(captionId)) return { error: "That pick didn't make sense. Try again." };

  const post = await getPost(postId);
  if (!post || post.user_id !== user.id || !post.captions.some((c) => c.id === captionId)) {
    return { error: "That caption isn't on your post." };
  }
  const wasDraft = post.status === "draft";

  const { error: updateError } = await supabase
    .from("generations")
    .update({ caption_id: captionId, status: "published" })
    .eq("id", postId);
  if (updateError) {
    console.error("[post] choosing caption failed", updateError);
    return { error: "We couldn't save your pick. Try again." };
  }

  const { error: deleteError } = await supabase
    .from("captions")
    .delete()
    .eq("generation_id", postId)
    .neq("id", captionId);
  if (deleteError) console.error("[post] clearing losing captions failed", deleteError);

  revalidatePath(`/post/${postId}`);
  revalidatePath("/top");
  redirect(`/post/${postId}?${wasDraft ? "new" : "remixed"}=1`);
}

export type RemixResult = { error: string };

/**
 * Remix (owner only, as often as they like): the AI writes 3 new captions in
 * a mood, and the owner battles them against the current caption. A photo
 * never has more than 4 captions, because the losers are deleted afterwards.
 */
export async function remixPost(postId: string, mood: string): Promise<RemixResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to remix." };
  if (!UUID.test(postId) || !isMood(mood)) return { error: "That remix didn't make sense. Try again." };

  const post = await getPost(postId);
  if (!post || post.user_id !== user.id || post.status !== "published") {
    return { error: "Only the person who posted this photo can remix it." };
  }
  const current = chosenCaption(post);

  const { data: usedToday } = await supabase.rpc("my_remixes_today");
  if ((usedToday ?? 0) >= REMIXES_PER_DAY) {
    return { error: `You've used all ${REMIXES_PER_DAY} remixes for today. Come back tomorrow!` };
  }

  // Clear challengers left over from an unfinished remix, so we stay at 4 captions max.
  if (post.caption_id) {
    await supabase.from("captions").delete().eq("generation_id", postId).neq("id", post.caption_id);
  }

  let result: Awaited<ReturnType<typeof writeCaptions>>;
  try {
    result = await writeCaptions({
      image: await fetchImage(post.image_url),
      voice: post.voice,
      theme: post.theme,
      mood,
      avoid: current ? [current.text] : [],
      count: REMIX_CAPTIONS,
    });
  } catch (error) {
    console.error("[post] remix failed", error);
    return {
      error: error instanceof CaptionWriterError ? error.userMessage : "Couldn't remix that photo right now. Try again.",
    };
  }

  const { data: remix, error: remixError } = await supabase
    .from("caption_remixes")
    .insert({ generation_id: postId, mood, prompt: result.prompt, model: result.model })
    .select("id")
    .single();
  if (remixError || !remix) {
    console.error("[post] saving remix failed", remixError);
    return { error: "Couldn't save your remix. Try again." };
  }

  const start = Math.max(4, ...post.captions.map((c) => c.position)) + 1;
  const { error: captionsError } = await supabase.from("captions").insert(
    result.captions.map((text, i) => ({ generation_id: postId, position: start + i, text, remix_id: remix.id })),
  );
  if (captionsError) {
    console.error("[post] saving remix captions failed", captionsError);
    return { error: `Couldn't add your ${MOODS[mood].label.toLowerCase()} captions. Try again.` };
  }

  redirect(`/post/${postId}/pick`);
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
  revalidatePath("/top");
  redirect("/members");
}
