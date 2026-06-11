"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Briefcase, Users, FileText,
  PlusCircle, Settings, LogOut, Building2,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Ofertas",
    href: "/admin/jobs",
    icon: Briefcase,
  },
  {
    label: "Empresas",
    href: "/admin/companies",
    icon: Building2,
  },
  {
    label: "Postulaciones",
    href: "/admin/applications",
    icon: FileText,
  },
  {
    label: "Candidatos",
    href: "/admin/candidates",
    icon: Users,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-60 shrink-0 hidden md:flex flex-col">
      <div className="bg-brand-navy rounded-2xl overflow-hidden h-full">
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <Link href="/admin" className="block mb-1">
            <Image
              src="/logo.png"
              alt="Get Company"
              width={120}
              height={36}
              className="h-9 w-auto brightness-0 invert"
            />
          </Link>
          <p className="text-white/40 text-xs pl-0.5">Panel de administración</p>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-1 flex-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                isActive(href, exact)
                  ? "bg-brand-blue text-white font-medium"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Acciones rápidas */}
        <div className="p-3 border-t border-white/10">
          <Link
            href="/admin/jobs/new"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-brand-yellow hover:bg-brand-yellow/10 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Nueva oferta
          </Link>
        </div>

        {/* Admin info + logout */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-blue/30 flex items-center justify-center">
              <Settings className="w-4 h-4 text-white/60" />
            </div>
            <div>
              <p className="text-white text-xs font-medium">Administrador</p>
              <p className="text-white/40 text-xs">Get Company</p>
            </div>
          </div>
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
