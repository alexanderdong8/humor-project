import { NextResponse, type NextRequest } from "next/server";
import { isProfileComplete, type Profile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Google sends the user back to Supabase, which redirects here with a one-time
 * `code`. Trading it for a session sets the auth cookies. First-time users
 * (blank names in their profile) go to onboarding, everyone else backstage.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    console.error("[auth/callback] missing code", searchParams.get("error"), searchParams.get("error_description"));
    return NextResponse.redirect(`${origin}/login?error=signin_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] code exchange failed", error?.message);
    return NextResponse.redirect(`${origin}/login?error=signin_failed`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle<Profile>();

  return NextResponse.redirect(`${origin}${isProfileComplete(profile) ? "/members" : "/onboarding"}`);
}
