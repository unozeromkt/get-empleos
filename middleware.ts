import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida el JWT con Supabase Auth y devuelve app_metadata actualizado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const role = user?.app_metadata?.role as string | undefined;

  const isCandidateRoute = pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/applications");
  const isAdminRoute   = pathname.startsWith("/admin");
  const isCompanyRoute = pathname.startsWith("/empresa");
  const isAuthRoute    = pathname.startsWith("/auth");

  // Sin sesión → redirigir a login con returnTo
  if (!user && (isCandidateRoute || isAdminRoute || isCompanyRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Con sesión → no permitir acceder a login/register
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = role === "admin" ? "/admin" : role === "company" ? "/empresa" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // Rutas /admin → solo admins
  if (user && isAdminRoute && role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = role === "company" ? "/empresa" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // Rutas /empresa → solo empresas
  if (user && isCompanyRoute && role !== "company") {
    const url = request.nextUrl.clone();
    url.pathname = role === "admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // Rutas de candidato → solo candidatos (no admins ni empresas)
  if (user && isCandidateRoute && role !== "candidate") {
    const url = request.nextUrl.clone();
    url.pathname = role === "admin" ? "/admin" : "/empresa";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
