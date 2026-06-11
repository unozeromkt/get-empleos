import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, ExternalLink, Share2 } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-brand-navy text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="mb-4">
              <Image
                src="/logo.png"
                alt="Get Company"
                width={130}
                height={40}
                className="h-10 w-auto brightness-0 invert"
              />
            </div>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              Portal de empleo de <strong className="text-white/80">Get Company</strong>, empresa colombiana
              líder en gestión humana y servicios temporales.
            </p>
            <div className="mt-4 space-y-2">
              <a
                href="https://maps.google.com"
                target="_blank"
                className="flex items-center gap-2 text-white/60 text-sm hover:text-white transition-colors"
              >
                <MapPin className="w-4 h-4 shrink-0" />
                Medellín, Antioquia, Colombia
              </a>
              <a
                href="tel:+576044000000"
                className="flex items-center gap-2 text-white/60 text-sm hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4 shrink-0" />
                (604) 400-0000
              </a>
              <a
                href="mailto:empleos@getcompany.co"
                className="flex items-center gap-2 text-white/60 text-sm hover:text-white transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" />
                empleos@getcompany.co
              </a>
            </div>
          </div>

          {/* Candidatos */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide text-white/40 mb-4">
              Candidatos
            </h3>
            <ul className="space-y-2">
              {[
                { href: "/jobs", label: "Ver ofertas" },
                { href: "/auth/register", label: "Crear cuenta" },
                { href: "/auth/login", label: "Iniciar sesión" },
                { href: "/dashboard", label: "Mi panel" },
                { href: "/profile", label: "Mi perfil" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide text-white/40 mb-4">
              Empresa
            </h3>
            <ul className="space-y-2">
              {[
                { href: "https://getcompany.co", label: "Sitio principal", external: true },
                { href: "https://getcompany.co/servicios", label: "Servicios", external: true },
                { href: "https://getcompany.co/nosotros", label: "Nosotros", external: true },
                { href: "https://getcompany.co/contacto", label: "Contacto", external: true },
              ].map(({ href, label, external }) => (
                <li key={href}>
                  <a
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Redes sociales */}
            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://linkedin.com/company/getcompany"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-brand-blue transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com/getcompany_co"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-brand-blue transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/40 text-sm">
            © {year} Get Company. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacidad" className="text-white/40 text-sm hover:text-white transition-colors">
              Política de privacidad
            </Link>
            <Link href="/terminos" className="text-white/40 text-sm hover:text-white transition-colors">
              Términos de uso
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
