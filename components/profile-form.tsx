"use client";

import { useActionState } from "react";
import { saveProfile, type ProfileFormState } from "@/app/profile/actions";
import styles from "./account.module.css";

type Props = {
  mode: "onboarding" | "profile";
  defaults: { firstName: string; lastName: string };
};

const initialState: ProfileFormState = { status: "idle" };

export function ProfileForm({ mode, defaults }: Props) {
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

      <div className={styles.actions}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : mode === "onboarding" ? "Let's go" : "Save changes"}
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
