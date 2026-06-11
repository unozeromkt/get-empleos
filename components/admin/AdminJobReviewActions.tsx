"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveJobAction, rejectJobAction } from "@/lib/actions/jobs";

interface Props {
  jobId: string;
}

export function AdminJobReviewActions({ jobId }: Props) {
  const router = useRouter();
  const [showReject, setShowReject]     = useState(false);
  const [notes, setNotes]               = useState("");
  const [error, setError]               = useState("");
  const [isApproving, startApprove]     = useTransition();
  const [isRejecting, startReject]      = useTransition();

  const handleApprove = () => {
    setError("");
    startApprove(async () => {
      const result = await approveJobAction(jobId);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  };

  const handleReject = () => {
    if (!notes.trim()) { setError("Escribe el motivo."); return; }
    setError("");
    startReject(async () => {
      const result = await rejectJobAction(jobId, notes);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-2 min-w-[160px]">
      {!showReject ? (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            disabled={isApproving}
            onClick={handleApprove}
            className="bg-brand-green hover:bg-brand-green/90 text-white text-xs h-7 px-2.5 flex-1"
          >
            {isApproving ? (
              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <><CheckCircle2 className="w-3 h-3 mr-1" />Aprobar</>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowReject(true)}
            className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7 px-2.5 flex-1"
          >
            <XCircle className="w-3 h-3 mr-1" />Rechazar
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5 bg-red-50 rounded-xl p-2 border border-red-100">
          <textarea
            autoFocus
            rows={2}
            placeholder="Motivo del rechazo..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-xs rounded-lg border border-red-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300 resize-none"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              disabled={isRejecting}
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 px-2 flex-1"
            >
              {isRejecting ? "..." : "Confirmar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setShowReject(false); setNotes(""); setError(""); }}
              className="text-xs h-7 px-2 flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
