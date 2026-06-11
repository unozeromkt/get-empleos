import Link from "next/link";
import { LayoutDashboard, Briefcase, Users, PlusCircle } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

const MOBILE_NAV = [
  { href: "/admin",            label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/jobs",       label: "Ofertas",   icon: Briefcase },
  { href: "/admin/candidates", label: "Candidatos", icon: Users },
  { href: "/admin/jobs/new",   label: "Nueva",     icon: PlusCircle },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-light flex">
      {/* Sidebar desktop */}
      <div className="p-4 hidden md:block">
        <AdminSidebar />
      </div>

      {/* Contenido */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </div>
      </main>

      {/* Bottom nav móvil */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-navy border-t border-white/10 z-40">
        <nav className="flex">
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-white/50 hover:text-white transition-colors"
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
