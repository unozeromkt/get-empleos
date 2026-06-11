"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Establece app_metadata.role solo para roles 'candidate' y 'company'.
// Nunca exponer un endpoint que pueda asignar 'admin'.
export async function setUserRoleAction(
  userId: string,
  role: "candidate" | "company"
) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (error) return { error: error.message };
  return { success: true };
}
