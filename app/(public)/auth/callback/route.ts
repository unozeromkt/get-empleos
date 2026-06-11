import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Crear perfil si no existe (primera vez con OAuth)
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existingProfile) {
        const fullName =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split("@")[0] ||
          "Usuario";

        // OAuth siempre crea candidatos; las empresas se registran con email/password
        await supabase.from("profiles").insert({
          id: data.user.id,
          full_name: fullName,
          email: data.user.email!,
          role: "candidate",
        });
      }

      const role = data.user.app_metadata?.role;

      // Redirigir según rol
      let redirectPath: string;
      if (role === "admin") {
        redirectPath = "/admin";
      } else if (role === "company") {
        // Si la empresa ya tiene perfil de empresa, ir al panel; si no, al onboarding
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("created_by", data.user.id)
          .maybeSingle();

        redirectPath = company ? "/empresa" : "/empresa/onboarding";
      } else {
        redirectPath = next;
      }

      return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/auth/login?error=oauth", requestUrl.origin)
  );
}
