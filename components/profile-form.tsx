"use client";

import { useActionState } from "react";
import { saveProfile, type ProfileFormState } from "@/app/profile/actions";
import styles from "./account.module.css";

type Props = {
  mode: "onboarding" | "profile";
  categories: string[];
  defaults: { firstName: string; lastName: string; favoriteCategory: string };
};

const initialState: ProfileFormState = { status: "idle" };

export function ProfileForm({ mode, categories, defaults }: Props) {
  const [state, formAction, pending] = useActionState(saveProfile, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="mode" value={mode} />

      <div className={styles.row}>
        <label className={styles.field}>
          <span>First name</span>
          <input
            name="firstName"
            defaultValue={defaults.firstName}
            autoComplete="given-name"
            maxLength={50}
            required
            aria-invalid={Boolean(errors.firstName)}
          />
          {errors.firstName && <small className={styles.fieldError}>{errors.firstName}</small>}
        </label>

        <label className={styles.field}>
          <span>Last name</span>
          <input
            name="lastName"
            defaultValue={defaults.lastName}
            autoComplete="family-name"
            maxLength={50}
            required
            aria-invalid={Boolean(errors.lastName)}
          />
          {errors.lastName && <small className={styles.fieldError}>{errors.lastName}</small>}
        </label>
      </div>

      <label className={styles.field}>
        <span>
          Favorite kind of joke <em>(optional)</em>
        </span>
        <select name="favoriteCategory" defaultValue={defaults.favoriteCategory}>
          <option value="">No favorite</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Saving…" : mode === "onboarding" ? "Enter the Green Room" : "Save changes"}
        </button>
        <p
          className={state.status === "error" ? styles.error : styles.success}
          role="status"
          aria-live="polite"
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}
