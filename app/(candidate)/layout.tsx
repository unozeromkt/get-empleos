import Image from "next/image";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CandidateSidebarNav, CandidateMobileNav } from "@/components/candidates/CandidateNav";
import { createClient } from "@/lib/supabase/server";

// Añade ?v=<timestamp> solo si la URL no tiene ya un parámetro de versión,
// asegurando que el caché de Next.js Image no sirva avatares obsoletos.
function avatarSrc(url: string, updatedAt: string | null | undefined): string {
  if (!url) return url;
  if (url.includes("?")) return url; // ya versionada (ej: ?v=... de uploadAvatarAction)
  const ts = updatedAt ? new Date(updatedAt).getTime() : 0;
  return ts ? `${url}?v=${ts}` : url;
}

export default async function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url, updated_at")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") redirect("/admin");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">

            {/* Sidebar — desktop */}
            <aside className="hidden md:block w-56 shrink-0">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden sticky top-24">
                <div className="p-4 bg-brand-navy text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-blue shrink-0 flex items-center justify-center">
                      {profile?.avatar_url ? (
                        <Image
                          src={avatarSrc(profile.avatar_url, profile.updated_at)}
                          alt={profile.full_name ?? "Avatar"}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-white">
                          {(profile?.full_name ?? "U")
                            .split(" ")
                            .slice(0, 2)
                            .map((w: string) => w[0])
                            .join("")
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{profile?.full_name ?? "Usuario"}</p>
                      <p className="text-xs text-white/60">Candidato</p>
                    </div>
                  </div>
                </div>
                <CandidateSidebarNav />
              </div>
            </aside>

            {/* Contenido */}
            <div className="flex-1 min-w-0 pb-20 md:pb-0">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de navegación móvil */}
      <CandidateMobileNav />

      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}
