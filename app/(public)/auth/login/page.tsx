"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Briefcase, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "";
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(oauthError === "oauth" ? "Error al iniciar sesión con Google. Intenta de nuevo." : "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      setLoading(false);
      return;
    }

    // Leer rol desde app_metadata del JWT (sin query a profiles)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    const role = user.app_metadata?.role;

    router.refresh();

    if (redirectTo) {
      router.push(redirectTo);
    } else if (role === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-brand-navy">
              Get<span className="text-brand-blue">Empleos</span>
            </span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-brand-navy">
            Bienvenido de nuevo
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Ingresa con tu correo y contraseña
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">
                Correo electrónico
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-brand-navy">
                  Contraseña
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-brand-blue hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold h-11"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Ingresando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Ingresar
                </span>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿No tienes cuenta?{" "}
          <Link href="/auth/register" className="text-brand-blue font-medium hover:underline">
            Regístrate gratis
          </Link>
        </p>

        <p className="text-center mt-4">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
