"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "../actions";
import styles from "../battle.module.css";

type Props = {
  userId: string;
  theme: string;
  voices: { id: string; label: string; blurb: string; example: string }[];
  remaining: number;
};

const MAX_EDGE = 1600;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const WRITING_LINES = [
  "Workshopping the bit…",
  "Running it by the group chat…",
  "Punching up the punchlines…",
  "Checking the tight four…",
];

/** Shrinks the photo to at most 1600px and re-encodes it as JPEG before upload. */
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

export function NewPostForm({ userId, theme, voices, remaining }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [voice, setVoice] = useState(voices[0]?.id ?? "groupchat");
  const [useTheme, setUseTheme] = useState(true);
  const [stage, setStage] = useState<"idle" | "uploading" | "writing">("idle");
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const busy = stage !== "idle";

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  useEffect(() => {
    if (stage !== "writing") return;
    const timer = setInterval(() => setLine((n) => (n + 1) % WRITING_LINES.length), 1800);
    return () => clearInterval(timer);
  }, [stage]);

  function choose(next: File | undefined) {
    setError(null);
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      setError("That's not a photo. Try a JPG, PNG, or HEIC.");
      return;
    }
    if (next.size > MAX_INPUT_BYTES) {
      setError("That photo is over 20 MB. Try a smaller one.");
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    setError(null);

    let blob: Blob;
    try {
      blob = await prepareImage(file);
    } catch {
      setError("We couldn't read that photo. Try a JPG or PNG.");
      return;
    }

    setStage("uploading");
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await createClient()
      .storage.from("caption-photos")
      .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (uploadError) {
      setError("Upload failed. Check your connection and try again.");
      setStage("idle");
      return;
    }

    setStage("writing");
    setLine(0);
    // On success the action redirects to the new post.
    const result = await createPost({ path, voice, useTheme });
    if (result?.error) {
      setError(result.error);
      setStage("idle");
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <h2 className={styles.step}>
        <span>1</span> Add a photo
      </h2>
      <div
        className={styles.drop}
        data-dragging={dragging || undefined}
        data-filled={preview ? true : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files?.[0]);
        }}
      >
        {preview ? (
          <img src={preview} alt="Your photo" className={styles.preview} />
        ) : (
          <div className={styles.dropPrompt}>
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
              <path
                fill="currentColor"
                d="M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
              />
            </svg>
            <p>
              <strong>Drop a photo here</strong> or pick one from your camera roll
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className={styles.fileInput}
          aria-label="Choose a photo"
          disabled={busy}
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </div>
      {preview && !busy && (
        <button type="button" className={styles.linkButton} onClick={() => inputRef.current?.click()}>
          Choose a different photo
        </button>
      )}

      <fieldset className={styles.voices} disabled={busy}>
        <legend className={styles.step}>
          <span>2</span> Pick how the captions should sound
        </legend>
        <div className={styles.voiceGrid}>
          {voices.map((v) => (
            <label key={v.id} className={styles.voice} data-checked={voice === v.id || undefined}>
              <input type="radio" name="voice" value={v.id} checked={voice === v.id} onChange={() => setVoice(v.id)} />
              <span className={styles.voiceLabel}>{v.label}</span>
              <span className={styles.voiceBlurb}>{v.blurb}</span>
              <span className={styles.voiceExample}>“{v.example}”</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <h2 className={styles.step}>
          <span>3</span> Today&apos;s theme <em>(optional)</em>
        </h2>
        <label className={styles.themeToggle}>
          <input type="checkbox" checked={useTheme} onChange={(e) => setUseTheme(e.target.checked)} disabled={busy} />
          <span>
            Tie the captions to <strong>{theme}</strong> if the photo fits
          </span>
        </label>
      </div>

      <div className={styles.submitRow}>
        <button type="submit" className={styles.primary} disabled={!file || busy}>
          {stage === "uploading" ? "Uploading…" : stage === "writing" ? WRITING_LINES[line] : "Write 4 captions"}
        </button>
        <p className={styles.hint}>
          {remaining} {remaining === 1 ? "post" : "posts"} left today
        </p>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
