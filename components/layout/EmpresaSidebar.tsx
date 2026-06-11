"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Briefcase, FileText, Building2,
  PlusCircle, LogOut, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import type { CompanyStatus } from "@/lib/types/database";

const NAV_ITEMS = [
  { label: "Dashboard",     href: "/empresa",               icon: LayoutDashboard, exact: true },
  { label: "Mis ofertas",   href: "/empresa/jobs",          icon: Briefcase },
  { label: "Postulaciones", href: "/empresa/postulaciones", icon: FileText },
  { label: "Mi empresa",    href: "/empresa/perfil",        icon: Building2 },
];

const STATUS_CONFIG: Record<CompanyStatus, { label: string; icon: typeof Clock; color: string }> = {
  pending:  { label: "Pendiente de aprobación", icon: Clock,         color: "text-amber-600 bg-amber-50" },
  approved: { label: "Empresa aprobada",         icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
  rejected: { label: "Solicitud rechazada",      icon: XCircle,      color: "text-red-600 bg-red-50" },
};

interface Props {
  companyName: string | null;
  companyStatus: CompanyStatus | null;
  logoUrl: string | null;
  newApplicationsCount: number;
}

export function EmpresaSidebar({ companyName, companyStatus, logoUrl, newApplicationsCount }: Props) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const badge = companyStatus ? STATUS_CONFIG[companyStatus] : null;

  return (
    <aside className="w-60 shrink-0 hidden md:flex flex-col h-[calc(100vh-2rem)]">
      <div className="bg-brand-navy rounded-2xl overflow-hidden flex flex-col h-full">
        {/* Logo */}
        <div className="p-5 border-b border-white/10 shrink-0">
          <Link href="/empresa" className="block mb-1">
            <Image
              src="/logo.png"
              alt="Get Company"
              width={120}
              height={36}
              className="h-9 w-auto brightness-0 invert"
            />
          </Link>
          <p className="text-white/40 text-xs">Portal de empresas</p>
        </div>

        {/* Info empresa */}
        <div className="px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-blue/20 flex items-center justify-center shrink-0 overflow-hidden">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={companyName ?? "Logo"}
                  width={36}
                  height={36}
                  unoptimized
                  className="w-full h-full object-contain p-0.5"
                />
              ) : (
                <Building2 className="w-4 h-4 text-brand-blue" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">
                {companyName ?? "Mi empresa"}
              </p>
              {badge && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.color}`}>
                  <badge.icon className="w-2.5 h-2.5" />
                  {badge.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto">
          {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            const showBadge = href === "/empresa/postulaciones" && newApplicationsCount > 0;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? "bg-brand-blue text-white font-medium"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {showBadge && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand-yellow text-brand-navy text-[10px] font-bold flex items-center justify-center">
                    {newApplicationsCount > 99 ? "99+" : newApplicationsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Nueva oferta — solo si está aprobada */}
        {companyStatus === "approved" && (
          <div className="p-3 border-t border-white/10 shrink-0">
            <Link
              href="/empresa/jobs/new"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-brand-yellow hover:bg-brand-yellow/10 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Nueva oferta
            </Link>
          </div>
        )}

        {/* Logout */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
