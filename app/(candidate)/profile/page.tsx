import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileFormClient } from "./profile-form-client";
import type { Profile, Candidate } from "@/lib/types/database";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: profileData }, { data: candidateData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("candidates").select("*").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <ProfileFormClient
      profile={profileData as Profile}
      candidate={candidateData as Candidate | null}
    />
  );
}
