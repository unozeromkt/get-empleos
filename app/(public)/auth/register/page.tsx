"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Briefcase, UserPlus, CheckCircle2, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { setUserRoleAction } from "@/lib/actions/auth";

type AccountType = "candidate" | "company";

export default function RegisterPage() {
  const router = useRouter();

  const [accountType, setAccountType] = useState<AccountType>("candidate");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.full_name, role: accountType },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(
          authError.message.includes("already registered") ||
          authError.message.includes("already been registered")
            ? "Este correo ya está registrado. ¿Quieres iniciar sesión?"
            : `Error: ${authError.message}`
        );
        return;
      }

      // Cuando el usuario existe pero hay confirmación de email activa,
      // Supabase devuelve user=null para evitar enumeración de cuentas.
      if (!data.user) {
        setSuccess(true);
        return;
      }

      // Setear app_metadata.role vía Admin API (necesario para que el middleware
      // pueda leer el rol desde el JWT sin queries extra a la DB)
      if (accountType === "company") {
        await setUserRoleAction(data.user.id, "company");
      }

      // Con confirmación de email activa: mostrar pantalla de éxito
      if (data.user && !data.session) {
        setSuccess(true);
        return;
      }

      // Sin confirmación de email: sesión activa, redirigir según rol
      if (data.user && data.session) {
        router.refresh();
        router.push(accountType === "company" ? "/empresa/onboarding" : "/dashboard");
      }

    } catch (err) {
      console.error("Error en registro:", err);
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-10 border border-gray-100 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-brand-green" />
          </div>
          <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">
            ¡Revisa tu correo!
          </h2>
          <p className="text-gray-500 text-sm mb-2">
            Te enviamos un enlace de confirmación a{" "}
            <strong>{form.email}</strong>.
          </p>
          {accountType === "company" && (
            <p className="text-gray-500 text-sm mb-6">
              Después de confirmar tu correo podrás completar el perfil de tu empresa y solicitar aprobación.
            </p>
          )}
          {accountType === "candidate" && (
            <p className="text-gray-500 text-sm mb-6">
              Haz clic en el enlace para activar tu cuenta y empezar a postularte.
            </p>
          )}
          <Link href="/auth/login">
            <Button className="w-full bg-brand-blue text-white">
              Ir al inicio de sesión
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
            Crea tu cuenta
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {accountType === "company"
              ? "Publica ofertas y encuentra el talento que necesitas"
              : "Regístrate gratis y empieza a postularte"}
          </p>
        </div>

        {/* Selector de tipo de cuenta */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setAccountType("candidate")}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-sm font-medium
              ${accountType === "candidate"
                ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
          >
            <User className={`w-6 h-6 ${accountType === "candidate" ? "text-brand-blue" : "text-gray-400"}`} />
            Soy candidato
          </button>
          <button
            type="button"
            onClick={() => setAccountType("company")}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-sm font-medium
              ${accountType === "company"
                ? "border-brand-navy bg-brand-navy/5 text-brand-navy"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
          >
            <Building2 className={`w-6 h-6 ${accountType === "company" ? "text-brand-navy" : "text-gray-400"}`} />
            Soy empresa
          </button>
        </div>

        {accountType === "company" && (
          <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl px-4 py-3 text-xs text-amber-700 mb-5">
            Tu empresa será revisada por el equipo de Get Company antes de poder publicar ofertas.
          </div>
        )}

        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}{" "}
                {error.includes("ya está registrado") && (
                  <Link href="/auth/login" className="underline font-medium">
                    Ingresar
                  </Link>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">
                {accountType === "company" ? "Nombre del representante" : "Nombre completo"}
              </label>
              <Input
                required
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                placeholder={accountType === "company" ? "Nombre y apellido" : "Carlos Martínez"}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">
                Correo electrónico
                {accountType === "company" && (
                  <span className="text-gray-400 font-normal"> (corporativo preferiblemente)</span>
                )}
              </label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">
                Confirmar contraseña
              </label>
              <Input
                type={showPassword ? "text" : "password"}
                required
                value={form.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
              />
            </div>

            <div className="text-xs text-gray-400 pt-1">
              Al registrarte aceptas nuestros{" "}
              <Link href="/terminos" className="text-brand-blue hover:underline">
                Términos de uso
              </Link>{" "}
              y{" "}
              <Link href="/privacidad" className="text-brand-blue hover:underline">
                Política de privacidad
              </Link>
              .
            </div>

            <Button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-semibold h-11 mt-2 ${
                accountType === "company"
                  ? "bg-brand-navy hover:bg-brand-navy/90"
                  : "bg-brand-blue hover:bg-brand-blue/90"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Creando cuenta...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  {accountType === "company" ? "Registrar empresa" : "Crear cuenta gratis"}
                </span>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href="/auth/login" className="text-brand-blue font-medium hover:underline">
            Ingresar
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
