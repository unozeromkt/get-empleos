import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Briefcase, FileText, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmpresaSidebar } from "@/components/layout/EmpresaSidebar";
import type { CompanyStatus } from "@/lib/types/database";

const MOBILE_NAV = [
  { href: "/empresa",               label: "Inicio",    icon: LayoutDashboard },
  { href: "/empresa/jobs",          label: "Ofertas",   icon: Briefcase },
  { href: "/empresa/postulaciones", label: "Candidatos", icon: FileText },
  { href: "/empresa/perfil",        label: "Empresa",   icon: Building2 },
];

export default async function EmpresaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, status, logo_url")
    .eq("created_by", user.id)
    .maybeSingle();

  // Contar postulaciones nuevas (status='pending') en las ofertas de esta empresa
  let newApplicationsCount = 0;
  if (company?.id) {
    const { count } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .in(
        "job_id",
        // subconsulta: ids de las ofertas activas de esta empresa
        (
          await supabase
            .from("jobs")
            .select("id")
            .eq("company_id", company.id)
            .eq("status", "active")
        ).data?.map((j) => j.id) ?? []
      );
    newApplicationsCount = count ?? 0;
  }

  return (
    <div className="min-h-screen bg-brand-light flex">
      {/* Sidebar desktop */}
      <div className="p-4 hidden md:block shrink-0">
        <EmpresaSidebar
          companyName={company?.name ?? null}
          companyStatus={(company?.status as CompanyStatus) ?? null}
          logoUrl={company?.logo_url ?? null}
          newApplicationsCount={newApplicationsCount}
        />
      </div>

      {/* Contenido principal */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </div>
      </main>

      {/* Bottom nav móvil */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-navy border-t border-white/10 z-40">
        <nav className="flex">
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const showBadge = href === "/empresa/postulaciones" && newApplicationsCount > 0;
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center gap-1 py-3 text-white/50 hover:text-white transition-colors relative"
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-yellow text-brand-navy text-[9px] font-bold flex items-center justify-center">
                      {newApplicationsCount > 99 ? "99+" : newApplicationsCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px]">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
