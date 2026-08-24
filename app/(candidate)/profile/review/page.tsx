import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";

import { CVProfileReview } from "@/components/candidates/CVProfileReview";
import {
  getCVProcessingStatusAction,
  getProfileSuggestionsAction,
} from "@/lib/actions/ai-candidates";
import { createClient } from "@/lib/supabase/server";

export default async function CVReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const status = await getCVProcessingStatusAction();

  // Sin CV subido no hay nada que revisar
  if (status.status === "none") redirect("/profile");

  const suggestions = await getProfileSuggestionsAction();
  const hasProfile = !("error" in suggestions);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/dashboard" className="hover:text-brand-blue">Inicio</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/profile" className="hover:text-brand-blue">Mi perfil</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium">Revisar hoja de vida</span>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-brand-purple" />
          Completamos tu perfil
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Leímos tu hoja de vida para ahorrarte escribirlo todo a mano.
        </p>
      </div>

      <CVProfileReview
        initialStatus={status.status}
        profileVersionId={hasProfile ? suggestions.profileVersionId : null}
        profile={hasProfile ? suggestions.profile : null}
        confidence={hasProfile ? suggestions.confidence : 0}
        filled={hasProfile ? suggestions.filled : {}}
        suggestions={hasProfile ? suggestions.suggestions : []}
        alreadyConfirmed={hasProfile ? suggestions.alreadyConfirmed : false}
      />
    </div>
  );
}
