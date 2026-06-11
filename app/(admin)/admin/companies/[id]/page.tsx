"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, Globe, MapPin, User, Hash,
  CheckCircle2, XCircle, Clock, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveCompanyAction, rejectCompanyAction } from "@/lib/actions/companies";
import type { Company } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export default function AdminCompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [company, setCompany] = useState<Company & { jobCount?: number } | null>(null);
  const [rejectReason, setRejectReason]   = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedback, setFeedback]           = useState("");
  const [isApproving, startApprove]       = useTransition();
  const [isRejecting, startReject]        = useTransition();

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("companies").select("*").eq("id", params.id).single(),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", params.id),
    ]).then(([{ data }, { count }]) => {
      if (data) setCompany({ ...(data as Company), jobCount: count ?? 0 });
    });
  }, [params.id]);

  if (!company) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="w-6 h-6 rounded-full border-2 border-brand-blue/30 border-t-brand-blue animate-spin" />
      </div>
    );
  }

  const handleApprove = () => {
    setFeedback("");
    startApprove(async () => {
      const result = await approveCompanyAction(company.id);
      if (result?.error) {
        setFeedback(result.error);
      } else {
        setFeedback("✓ Empresa aprobada correctamente.");
        setCompany((c) => c ? { ...c, status: "approved" } : c);
        setTimeout(() => router.push("/admin/companies?status=pending"), 1500);
      }
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      setFeedback("Ingresa un motivo de rechazo.");
      return;
    }
    setFeedback("");
    startReject(async () => {
      const result = await rejectCompanyAction(company.id, rejectReason);
      if (result?.error) {
        setFeedback(result.error);
      } else {
        setFeedback("Empresa rechazada.");
        setCompany((c) => c ? { ...c, status: "rejected", rejection_reason: rejectReason } : c);
        setShowRejectForm(false);
        setTimeout(() => router.push("/admin/companies?status=pending"), 1500);
      }
    });
  };

  const statusIcon = {
    pending:  <Clock className="w-4 h-4 text-amber-600" />,
    approved: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    rejected: <XCircle className="w-4 h-4 text-red-600" />,
  }[company.status];

  const statusLabel = {
    pending:  "Pendiente de revisión",
    approved: "Aprobada",
    rejected: "Rechazada",
  }[company.status];

  const statusColor = {
    pending:  "bg-amber-50 border-amber-200 text-amber-800",
    approved: "bg-emerald-50 border-emerald-200 text-emerald-800",
    rejected: "bg-red-50 border-red-200 text-red-800",
  }[company.status];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb + back */}
      <div className="flex items-center gap-3">
        <Link href="/admin/companies" className="text-gray-400 hover:text-brand-navy">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy">
            {company.name}
          </h1>
          <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border mt-1 ${statusColor}`}>
            {statusIcon}
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Tarjeta de datos */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        <InfoRow icon={<Building2 className="w-4 h-4" />} label="Razón social" value={company.name} />
        <InfoRow icon={<Hash className="w-4 h-4" />} label="NIT" value={company.nit ?? "—"} />
        <InfoRow icon={<User className="w-4 h-4" />} label="Representante legal" value={company.legal_rep ?? "—"} />
        <InfoRow icon={<MapPin className="w-4 h-4" />} label="Ciudad" value={company.city ?? "—"} />
        <InfoRow icon={<Briefcase className="w-4 h-4" />} label="Sector" value={company.industry ?? "—"} />
        {company.website && (
          <InfoRow
            icon={<Globe className="w-4 h-4" />}
            label="Sitio web"
            value={
              <a href={company.website} target="_blank" rel="noopener noreferrer"
                className="text-brand-blue hover:underline">
                {company.website}
              </a>
            }
          />
        )}
        {company.description && (
          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Descripción</p>
            <p className="text-sm text-gray-700 leading-relaxed">{company.description}</p>
          </div>
        )}
      </div>

      {/* Estadísticas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
        <Briefcase className="w-4 h-4 text-brand-blue" />
        <p className="text-sm text-gray-600">
          {company.jobCount ?? 0} oferta{company.jobCount !== 1 ? "s" : ""} creada{company.jobCount !== 1 ? "s" : ""}
        </p>
        <Link href={`/admin/jobs?company=${company.id}`} className="ml-auto text-xs text-brand-blue hover:underline">
          Ver ofertas
        </Link>
      </div>

      {/* Historial de rechazo */}
      {company.status === "rejected" && company.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-medium text-red-800 mb-1">Motivo de rechazo anterior:</p>
          <p className="text-sm text-red-700">{company.rejection_reason}</p>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${
          feedback.startsWith("✓")
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-600"
        }`}>
          {feedback}
        </div>
      )}

      {/* Acciones */}
      <div className="space-y-3">
        {company.status !== "approved" && (
          <Button
            onClick={handleApprove}
            disabled={isApproving}
            className="w-full bg-brand-green hover:bg-brand-green/90 text-white h-11"
          >
            {isApproving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Aprobando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Aprobar empresa
              </span>
            )}
          </Button>
        )}

        {company.status !== "rejected" && !showRejectForm && (
          <Button
            onClick={() => setShowRejectForm(true)}
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50 h-11"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Rechazar empresa
          </Button>
        )}

        {showRejectForm && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
            <label className="block text-sm font-medium text-red-800">
              Motivo del rechazo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explica por qué se rechaza esta empresa..."
              className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleReject}
                disabled={isRejecting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isRejecting ? "Rechazando..." : "Confirmar rechazo"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowRejectForm(false); setRejectReason(""); }}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {company.status === "approved" && (
          <p className="text-xs text-gray-400 text-center">
            Empresa aprobada el{" "}
            {company.approved_at
              ? new Date(company.approved_at).toLocaleDateString("es-CO", {
                  day: "numeric", month: "long", year: "numeric",
                })
              : "—"}
          </p>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className="text-gray-400 shrink-0">{icon}</span>
      <span className="text-xs text-gray-400 w-36 shrink-0">{label}</span>
      <span className="text-sm text-brand-navy">{value}</span>
    </div>
  );
}
