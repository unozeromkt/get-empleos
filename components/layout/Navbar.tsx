"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, User, LogIn, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type AuthUser = {
  name: string;
  role: "admin" | "candidate";
} | null;

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setUser(null);
        setLoadingAuth(false);
        return;
      }

      const role = (authUser.app_metadata?.role ?? "candidate") as "admin" | "candidate";

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", authUser.id)
        .maybeSingle();

      const name =
        profile?.full_name ??
        (authUser.user_metadata?.full_name as string | undefined) ??
        authUser.email ??
        "Usuario";

      setUser({ name, role });
      setLoadingAuth(false);
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setLoadingAuth(false);
      } else {
        loadUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <nav
      className={`bg-white sticky top-0 z-50 transition-shadow duration-200 ${
        scrolled ? "shadow-md" : "shadow-sm border-b border-gray-100"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/logo.png"
              alt="Get Company"
              width={120}
              height={36}
              className="h-9 w-auto"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7">
            <Link
              href="/jobs"
              className="text-sm font-medium text-brand-navy/70 hover:text-brand-navy transition-colors"
            >
              Ofertas de empleo
            </Link>
            <a
              href="https://getcompany.co/get-empleos/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-navy/70 hover:text-brand-navy transition-colors"
            >
              Nosotros
            </a>
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-2">
            {!loadingAuth && (
              user ? (
                <>
                  <Link href={user.role === "admin" ? "/admin" : "/dashboard"}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-brand-navy/20 text-brand-navy hover:bg-brand-navy/5 rounded-full"
                    >
                      {user.role === "admin" ? (
                        <LayoutDashboard className="w-4 h-4 mr-1.5" />
                      ) : (
                        <User className="w-4 h-4 mr-1.5" />
                      )}
                      {user.name.split(" ")[0]}
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-brand-navy/50 hover:text-brand-navy hover:bg-brand-navy/5"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/auth/login">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-brand-navy/70 hover:text-brand-navy hover:bg-brand-navy/5 font-medium"
                    >
                      <LogIn className="w-4 h-4 mr-1.5" />
                      Ingresar
                    </Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button
                      size="sm"
                      className="bg-brand-navy hover:bg-brand-navy/90 text-white font-semibold rounded-full px-5"
                    >
                      Registrarse
                    </Button>
                  </Link>
                </>
              )
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-brand-navy/5 transition-colors text-brand-navy"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menú"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-4 space-y-1">
            <Link
              href="/jobs"
              className="block text-sm font-medium text-brand-navy/70 hover:text-brand-navy hover:bg-brand-navy/5 rounded-lg px-3 py-2.5 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Ofertas de empleo
            </Link>
            <a
              href="https://getcompany.co/get-empleos/"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-medium text-brand-navy/70 hover:text-brand-navy hover:bg-brand-navy/5 rounded-lg px-3 py-2.5 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Nosotros
            </a>
            <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
              {!loadingAuth && (
                user ? (
                  <>
                    <Link
                      href={user.role === "admin" ? "/admin" : "/dashboard"}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Button size="sm" className="w-full bg-brand-navy text-white rounded-full">
                        {user.role === "admin" ? "Panel admin" : "Mi perfil"}
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-brand-navy/20 text-brand-navy rounded-full"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4 mr-1" />
                      Cerrar sesión
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/auth/login" onClick={() => setMenuOpen(false)}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-brand-navy/20 text-brand-navy rounded-full"
                      >
                        Ingresar
                      </Button>
                    </Link>
                    <Link href="/auth/register" onClick={() => setMenuOpen(false)}>
                      <Button size="sm" className="w-full bg-brand-navy text-white rounded-full">
                        Registrarse
                      </Button>
                    </Link>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
