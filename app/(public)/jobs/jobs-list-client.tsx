"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { JobCard } from "@/components/jobs/JobCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import type { JobWithCompany, JobArea } from "@/lib/types/database";

const MODALITIES = [
  { value: "presencial", label: "Presencial" },
  { value: "remoto",     label: "Remoto" },
  { value: "hibrido",    label: "Híbrido" },
];

const CONTRACT_TYPES = [
  { value: "tiempo_completo", label: "Tiempo completo" },
  { value: "tiempo_parcial",  label: "Tiempo parcial" },
  { value: "temporal",        label: "Temporal" },
  { value: "por_obra",        label: "Por obra" },
];

interface Props {
  jobs:  JobWithCompany[];
  areas: JobArea[];
}

export function JobsListClient({ jobs, areas }: Props) {
  const params = useSearchParams();
  const [search,           setSearch]           = useState(params.get("q") ?? "");
  const [selectedArea,     setSelectedArea]     = useState(params.get("area") ?? "");
  const [selectedCity,     setSelectedCity]     = useState(params.get("city") ?? "");
  const [selectedModality, setSelectedModality] = useState("");
  const [selectedContract, setSelectedContract] = useState("");
  const [showFilters,      setShowFilters]      = useState(false);

  const CITIES = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.city))).sort(),
    [jobs]
  );

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const q = search.toLowerCase();
      if (q && !job.title.toLowerCase().includes(q) && !job.city.toLowerCase().includes(q)) return false;
      if (selectedArea     && job.area?.slug    !== selectedArea)     return false;
      if (selectedCity     && job.city          !== selectedCity)     return false;
      if (selectedModality && job.modality      !== selectedModality) return false;
      if (selectedContract && job.contract_type !== selectedContract) return false;
      return true;
    });
  }, [jobs, search, selectedArea, selectedCity, selectedModality, selectedContract]);

  // Conteos facetados: cada dimensión se calcula ignorando su propio filtro
  // para mostrar cuántos resultados habría al seleccionarla
  const matchesBase = useMemo(() => (job: JobWithCompany) => {
    const q = search.toLowerCase();
    if (q && !job.title.toLowerCase().includes(q) && !job.city.toLowerCase().includes(q)) return false;
    if (selectedCity     && job.city          !== selectedCity)     return false;
    if (selectedModality && job.modality      !== selectedModality) return false;
    if (selectedContract && job.contract_type !== selectedContract) return false;
    return true;
  }, [search, selectedCity, selectedModality, selectedContract]);

  const areaCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach((job) => {
      if (!matchesBase(job)) return;
      const slug = job.area?.slug ?? "";
      if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
    });
    return counts;
  }, [jobs, matchesBase]);

  const hasFilters = !!(selectedArea || selectedCity || selectedModality || selectedContract);

  const clearAll = () => {
    setSelectedArea("");
    setSelectedCity("");
    setSelectedModality("");
    setSelectedContract("");
    setSearch("");
  };

  return (
    <>
      {/* Header */}
      <section className="bg-brand-navy text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-bold mb-1">Ofertas de trabajo</h1>
          <p className="text-white/60 mb-6">{jobs.length} vacantes disponibles en Colombia</p>
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cargo o ciudad..."
              className="w-full pl-9 pr-9 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-brand-blue text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="flex-1 bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">

            {/* Sidebar filtros — desktop */}
            <aside className="hidden lg:block w-60 shrink-0">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 sticky top-24">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-brand-navy text-sm">Filtros</h2>
                  {(hasFilters || search) && (
                    <button onClick={clearAll} className="text-xs text-brand-blue hover:underline">
                      Limpiar todo
                    </button>
                  )}
                </div>

                <FilterSection label="Área">
                  {areas.map((area) => (
                    <FilterButton
                      key={area.slug}
                      label={area.name}
                      count={areaCounts[area.slug] ?? 0}
                      active={selectedArea === area.slug}
                      onClick={() => setSelectedArea(selectedArea === area.slug ? "" : area.slug)}
                    />
                  ))}
                </FilterSection>

                <FilterSection label="Ciudad">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  >
                    <option value="">Todas</option>
                    {CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FilterSection>

                <FilterSection label="Modalidad">
                  {MODALITIES.map((m) => (
                    <FilterButton
                      key={m.value}
                      label={m.label}
                      active={selectedModality === m.value}
                      onClick={() => setSelectedModality(selectedModality === m.value ? "" : m.value)}
                    />
                  ))}
                </FilterSection>

                <FilterSection label="Tipo de contrato" last>
                  {CONTRACT_TYPES.map((c) => (
                    <FilterButton
                      key={c.value}
                      label={c.label}
                      active={selectedContract === c.value}
                      onClick={() => setSelectedContract(selectedContract === c.value ? "" : c.value)}
                    />
                  ))}
                </FilterSection>
              </div>
            </aside>

            {/* Listado */}
            <div className="flex-1 min-w-0">
              {/* Mobile: toggle filtros */}
              <div className="lg:hidden mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal className="w-4 h-4 mr-1.5" />
                  Filtros
                  {hasFilters && (
                    <span className="ml-1.5 bg-brand-blue text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                      !
                    </span>
                  )}
                </Button>
              </div>

              {showFilters && (
                <div className="lg:hidden bg-white rounded-2xl p-4 border border-gray-100 mb-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Área</label>
                    <select
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <option value="">Todas</option>
                      {areas.map((a) => (
                        <option key={a.slug} value={a.slug}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Ciudad</label>
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <option value="">Todas</option>
                      {CITIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Modalidad</label>
                    <select
                      value={selectedModality}
                      onChange={(e) => setSelectedModality(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <option value="">Todas</option>
                      {MODALITIES.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Contrato</label>
                    <select
                      value={selectedContract}
                      onChange={(e) => setSelectedContract(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <option value="">Todos</option>
                      {CONTRACT_TYPES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  {(hasFilters || search) && (
                    <button onClick={clearAll} className="col-span-2 text-xs text-brand-blue text-center">
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-500 mb-5 hidden lg:block">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                {hasFilters || search ? " para tu búsqueda" : " disponibles"}
              </p>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No encontramos ofertas"
                  description="Intenta ajustar los filtros o el texto de búsqueda."
                  action={
                    <Button variant="outline" onClick={clearAll} className="border-brand-blue text-brand-blue">
                      Limpiar filtros
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filtered.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FilterSection({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`${last ? "" : "mb-5 pb-5 border-b border-gray-100"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
        active
          ? "bg-brand-blue/10 text-brand-blue font-medium"
          : count === 0
          ? "text-gray-300 cursor-default"
          : "text-gray-600 hover:bg-gray-50"
      }`}
      disabled={count === 0 && !active}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-xs tabular-nums shrink-0 ${
          active ? "text-brand-blue/70" : count === 0 ? "text-gray-300" : "text-gray-400"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}
