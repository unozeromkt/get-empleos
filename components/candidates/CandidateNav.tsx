"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, User, FileText, Search } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Inicio",        icon: LayoutDashboard },
  { href: "/profile",      label: "Mi perfil",     icon: User },
  { href: "/applications", label: "Postulaciones", icon: FileText },
  { href: "/jobs",         label: "Buscar empleo", icon: Search },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function CandidateSidebarNav() {
  const isActive = useActive();
  return (
    <nav className="p-2">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
            isActive(href)
              ? "bg-brand-blue/10 text-brand-blue font-medium"
              : "text-gray-600 hover:bg-brand-blue/5 hover:text-brand-blue"
          }`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function CandidateMobileNav() {
  const isActive = useActive();
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <nav className="flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              isActive(href) ? "text-brand-blue" : "text-gray-400 hover:text-brand-blue"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
