"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import styles from "@/components/account.module.css";

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

type Props = { userId: string; name: string; avatarUrl: string | null };

/**
 * Uploads the photo straight from the browser to Supabase Storage at
 * avatars/<user id>/<timestamp>.<ext>, then stores only its public URL on the
 * profile row. Storage policies limit each user to their own folder.
 */
export function AvatarUploader({ userId, name, avatarUrl }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(avatarUrl);
  const [status, setStatus] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      setStatus({ kind: "error", text: "Use a PNG, JPG, WebP, or GIF image." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus({ kind: "error", text: "That image is over 5 MB." });
      return;
    }

    setBusy(true);
    setStatus(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: "3600" });
    if (uploadError) {
      setStatus({ kind: "error", text: `Upload failed: ${uploadError.message}` });
      setBusy(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: saveError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (saveError) {
      setStatus({ kind: "error", text: `Couldn't save photo: ${saveError.message}` });
      setBusy(false);
      return;
    }

    // Clean up older photos so each member keeps just one.
    const { data: existing } = await supabase.storage.from(BUCKET).list(userId);
    const stale = (existing ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== path);
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale);

    setPreview(publicUrl);
    setStatus({ kind: "success", text: "Photo updated." });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className={styles.avatarUploader}>
      <Avatar url={preview} name={name} size={96} />
      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className={styles.secondary}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Uploading…" : preview ? "Change photo" : "Upload a photo"}
        </button>
        <p className={styles.hint}>PNG, JPG, WebP, or GIF · up to 5 MB</p>
        {status && (
          <p className={status.kind === "error" ? styles.error : styles.success} role="status">
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}
