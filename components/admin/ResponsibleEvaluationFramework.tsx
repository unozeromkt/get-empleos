import { ExternalLink, ShieldCheck } from "lucide-react";

const REFERENCES = [
  {
    label: "ISO 10667-2",
    description: "Evaluación de personas en selección",
    href: "https://www.iso.org/obp/ui?_escaped_fragment_=iso%3Astd%3Aiso%3A10667%3A-2%3Aed-2%3Av1%3Aen",
  },
  {
    label: "ISO 30405",
    description: "Directrices de contratación",
    href: "https://www.iso.org/standard/79488.html",
  },
  {
    label: "SIC — Circular 002 de 2024",
    description: "Tratamiento de datos personales con IA",
    href: "https://sedeelectronica.sic.gov.co/transparencia/normativa/circular-externa-2-de-2024-de-la-superintendencia-de-industria-y-comercio-lineamientos-sobre-el-tratamiento-de-datos",
  },
  {
    label: "Ley 1581 de 2012",
    description: "Protección de datos personales",
    href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981",
  },
  {
    label: "Ley 2466 de 2025",
    description: "Disposiciones laborales y no discriminación",
    href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=260676",
  },
  {
    label: "NIST AI RMF",
    description: "Gestión de riesgos de inteligencia artificial",
    href: "https://www.nist.gov/itl/ai-risk-management-framework",
  },
  {
    label: "SIOP",
    description: "IA en evaluación y selección de talento",
    href: "https://www.siop.org/wp-content/uploads/2024/12/Artificial-Intelligence-in-Talent-Assessment-and-Selection.pdf",
  },
] as const;

export function ResponsibleEvaluationFramework() {
  return (
    <section
      aria-labelledby="responsible-evaluation-title"
      className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand-blue/10 p-2 text-brand-blue">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2
            id="responsible-evaluation-title"
            className="font-display text-sm font-semibold text-brand-navy"
          >
            Marco de evaluación responsable
          </h2>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-gray-500">
            Referencias consideradas al diseñar la selección, privacidad,
            explicabilidad y gestión de riesgos del sistema. No implican certificación
            ISO ni aval de las entidades mencionadas.
          </p>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {REFERENCES.map(({ label, description, href }) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full items-start justify-between gap-3 rounded-xl border border-gray-100 bg-brand-light/60 px-3 py-2.5 transition-colors hover:border-brand-blue/30 hover:bg-brand-blue/5"
            >
              <span>
                <span className="block text-xs font-semibold text-brand-navy">{label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">
                  {description}
                </span>
              </span>
              <ExternalLink
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400 transition-colors group-hover:text-brand-blue"
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
