"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: { firstName?: string; lastName?: string };
};

const MAX_NAME_LENGTH = 50;

function cleanName(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const firstName = cleanName(formData.get("firstName"));
  const lastName = cleanName(formData.get("lastName"));

  const fieldErrors: ProfileFormState["fieldErrors"] = {};
  if (!firstName) fieldErrors.firstName = "First name is required.";
  else if (firstName.length > MAX_NAME_LENGTH) fieldErrors.firstName = "Keep it under 50 characters.";
  if (!lastName) fieldErrors.lastName = "Last name is required.";
  else if (lastName.length > MAX_NAME_LENGTH) fieldErrors.lastName = "Keep it under 50 characters.";
  if (fieldErrors.firstName || fieldErrors.lastName) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    updated_at: new Date().toISOString(),
  });
  if (error) return { status: "error", message: `Couldn't save: ${error.message}` };

  revalidatePath("/", "layout");
  // Onboarding finishes on the home page, which becomes the member's dashboard.
  if (formData.get("mode") === "onboarding") redirect("/");
  return { status: "success", message: "Profile saved." };
}
