import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Eye, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/date";

type CandidateRow = {
  id: string;
  career: string | null;
  years_experience: number;
  education_level: string | null;
  cv_url: string | null;
  profile: {
    full_name: string;
    email: string;
    created_at: string;
    avatar_url: string | null;
  };
};

export default async function AdminCandidatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const { data: candidatesData } = await supabase
    .from("candidates")
    .select("id, career, years_experience, education_level, cv_url, profile:profiles(full_name, email, created_at, avatar_url)")
    .order("id");

  // Supabase devuelve las relaciones anidadas como arrays; usamos unknown para el cast
  const candidates = (candidatesData ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const profileArr = r.profile as Record<string, unknown>[];
    const profile = Array.isArray(profileArr) ? profileArr[0] : profileArr;
    return {
      id:               r.id as string,
      career:           r.career as string | null,
      years_experience: r.years_experience as number,
      education_level:  r.education_level as string | null,
      cv_url:           r.cv_url as string | null,
      profile: {
        full_name:  profile?.full_name  as string,
        email:      profile?.email      as string,
        created_at: profile?.created_at as string,
        avatar_url: (profile?.avatar_url as string | null) ?? null,
      },
    } as CandidateRow;
  });

  // Postulaciones por candidato
  const { data: appCounts } = await supabase
    .from("applications")
    .select("candidate_id");

  const appsPerCandidate = (appCounts ?? []).reduce((acc, { candidate_id }) => {
    acc[candidate_id] = (acc[candidate_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Base de candidatos</h1>
        <p className="text-gray-500 text-sm mt-1">{candidates.length} candidatos registrados</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Candidato</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Perfil profesional</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">CV</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Postulaciones</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">Registrado</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-navy/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {candidate.profile.avatar_url ? (
                          <Image
                            src={candidate.profile.avatar_url}
                            alt={candidate.profile.full_name}
                            width={36}
                            height={36}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-bold text-brand-navy">
                            {candidate.profile.full_name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-brand-navy">{candidate.profile.full_name}</p>
                        <p className="text-xs text-gray-400">{candidate.profile.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <p className="text-gray-700">{candidate.career ?? "—"}</p>
                    <p className="text-xs text-gray-400">
                      {candidate.years_experience} años exp. · {candidate.education_level ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-center hidden sm:table-cell">
                    {candidate.cv_url ? (
                      <CheckCircle2 className="w-4 h-4 text-brand-green mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-gray-700 font-medium">
                      {appsPerCandidate[candidate.id] ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell text-xs text-gray-500">
                    {formatDate(candidate.profile.created_at)}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/candidates/${candidate.id}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors inline-flex"
                      title="Ver perfil"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                    No hay candidatos registrados aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
