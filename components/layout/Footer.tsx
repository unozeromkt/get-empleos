import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, ExternalLink, Share2 } from "lucide-react";

const RESPONSIBLE_EVALUATION_REFERENCES = [
  {
    label: "ISO 10667-2 — evaluación en selección",
    href: "https://www.iso.org/obp/ui?_escaped_fragment_=iso%3Astd%3Aiso%3A10667%3A-2%3Aed-2%3Av1%3Aen",
  },
  {
    label: "ISO 30405 — directrices de contratación",
    href: "https://www.iso.org/standard/79488.html",
  },
  {
    label: "SIC — Circular Externa 002 de 2024",
    href: "https://sedeelectronica.sic.gov.co/transparencia/normativa/circular-externa-2-de-2024-de-la-superintendencia-de-industria-y-comercio-lineamientos-sobre-el-tratamiento-de-datos",
  },
  {
    label: "Ley 1581 de 2012 — protección de datos",
    href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981",
  },
  {
    label: "Ley 2466 de 2025 — reforma laboral",
    href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=260676",
  },
  {
    label: "NIST AI RMF — gestión de riesgos de IA",
    href: "https://www.nist.gov/itl/ai-risk-management-framework",
  },
  {
    label: "SIOP — IA en evaluación y selección",
    href: "https://www.siop.org/wp-content/uploads/2024/12/Artificial-Intelligence-in-Talent-Assessment-and-Selection.pdf",
  },
] as const;

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

        <div className="mt-10 border-t border-white/10 pt-6">
          <h3 className="font-semibold text-sm text-white/80">
            Marco de evaluación responsable
          </h3>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-white/45">
            El diseño del sistema considera estas normas y guías sobre selección,
            privacidad, explicabilidad y gestión de riesgos. Son referencias de diseño;
            su publicación aquí no implica certificación ISO ni aval de las entidades.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {RESPONSIBLE_EVALUATION_REFERENCES.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-white/55 transition-colors hover:text-white"
                >
                  {label}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
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
