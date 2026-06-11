import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Building2, Globe, MapPin, Clock, CheckCircle2, XCircle,
  AlertCircle, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types/database";

const STATUS_TABS = [
  { value: "",         label: "Todas" },
  { value: "pending",  label: "Pendientes" },
  { value: "approved", label: "Aprobadas" },
  { value: "rejected", label: "Rechazadas" },
];

const STATUS_CONFIG = {
  pending:  { label: "Pendiente",  icon: Clock,         color: "bg-amber-100 text-amber-700" },
  approved: { label: "Aprobada",   icon: CheckCircle2,  color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rechazada",  icon: XCircle,       color: "bg-red-100 text-red-600" },
};

interface Props {
  searchParams: { status?: string };
}

export default async function AdminCompaniesPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  let query = supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (searchParams.status) {
    query = query.eq("status", searchParams.status);
  }

  const { data } = await query;
  const companies = (data ?? []) as Company[];

  // Contar pendientes para el badge
  const { count: pendingCount } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy">Empresas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {companies.length} empresa{companies.length !== 1 ? "s" : ""}
            {searchParams.status ? ` con estado "${searchParams.status}"` : " en total"}
          </p>
        </div>
      </div>

      {/* Alerta de pendientes */}
      {(pendingCount ?? 0) > 0 && !searchParams.status && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{pendingCount} empresa{pendingCount !== 1 ? "s" : ""}</strong> esperando aprobación.
          </p>
          <a href="?status=pending" className="ml-auto">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
              Revisar ahora
            </Button>
          </a>
        </div>
      )}

      {/* Tabs de estado */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(({ value, label }) => (
          <a
            key={value}
            href={value ? `?status=${value}` : "?"}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              (searchParams.status ?? "") === value
                ? "bg-brand-navy text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-navy"
            }`}
          >
            {label}
            {value === "pending" && (pendingCount ?? 0) > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* Listado */}
      {companies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {searchParams.status
              ? `No hay empresas con estado "${searchParams.status}".`
              : "Aún no hay empresas registradas."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map((company) => (
            <CompanyRow key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyRow({ company }: { company: Company }) {
  const status = STATUS_CONFIG[company.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
      {/* Logo */}
      <div className="w-12 h-12 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
        {company.logo_url ? (
          <Image
            src={company.logo_url}
            alt={company.name}
            width={48}
            height={48}
            className="w-full h-full object-contain p-1"
          />
        ) : (
          <Building2 className="w-6 h-6 text-gray-300" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-brand-navy">{company.name}</p>
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-gray-500">
          {company.nit && <span>NIT: {company.nit}</span>}
          {company.legal_rep && <span>Rep: {company.legal_rep}</span>}
          {company.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />{company.city}
            </span>
          )}
          {company.industry && <span>{company.industry}</span>}
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-brand-blue hover:underline"
            >
              <Globe className="w-3 h-3" />Sitio web
            </a>
          )}
        </div>
        {company.status === "rejected" && company.rejection_reason && (
          <p className="text-xs text-red-500 mt-1">
            Rechazo: {company.rejection_reason}
          </p>
        )}
      </div>

      {/* Acción */}
      <div className="shrink-0">
        <Link href={`/admin/companies/${company.id}`}>
          <Button
            size="sm"
            variant="outline"
            className={
              company.status === "pending"
                ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                : "border-gray-200 text-gray-600"
            }
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            {company.status === "pending" ? "Revisar" : "Ver detalle"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
