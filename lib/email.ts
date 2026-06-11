import { Resend } from "resend";
import { render } from "@react-email/components";
import ApplicationReceived from "@/emails/ApplicationReceived";
import StatusChanged from "@/emails/StatusChanged";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "empleos@getcompany.co";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ─── Email: Postulación recibida ──────────────────────────────────────────────

export async function sendApplicationReceivedEmail(opts: {
  to:            string;
  candidateName: string;
  jobTitle:      string;
  jobCity:       string;
  appliedAt:     string;
}) {
  if (!process.env.RESEND_API_KEY) {
    // En desarrollo sin API key, solo loguear
    console.log("[email] ApplicationReceived →", opts);
    return;
  }

  const html = await render(
    ApplicationReceived({
      candidateName: opts.candidateName,
      jobTitle:      opts.jobTitle,
      jobCity:       opts.jobCity,
      appliedAt:     opts.appliedAt,
      dashboardUrl:  `${SITE_URL}/applications`,
    })
  );

  const { error } = await resend.emails.send({
    from:    `GetEmpleos <${FROM}>`,
    to:      opts.to,
    subject: `✅ Postulación recibida: ${opts.jobTitle}`,
    html,
  });

  if (error) {
    console.error("[email] Error enviando ApplicationReceived:", error);
  }
}

// ─── Email: Estado de postulación actualizado ─────────────────────────────────

export async function sendStatusChangedEmail(opts: {
  to:            string;
  candidateName: string;
  jobTitle:      string;
  newStatus:     "reviewing" | "shortlisted" | "rejected" | "hired";
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log("[email] StatusChanged →", opts);
    return;
  }

  const html = await render(
    StatusChanged({
      candidateName: opts.candidateName,
      jobTitle:      opts.jobTitle,
      newStatus:     opts.newStatus,
      dashboardUrl:  `${SITE_URL}/applications`,
    })
  );

  const STATUS_SUBJECTS: Record<string, string> = {
    reviewing:   `🔍 Tu postulación a ${opts.jobTitle} está en revisión`,
    shortlisted: `⭐ ¡Has sido preseleccionado para ${opts.jobTitle}!`,
    rejected:    `📋 Actualización sobre tu postulación a ${opts.jobTitle}`,
    hired:       `🎉 ¡Felicitaciones! Fuiste seleccionado para ${opts.jobTitle}`,
  };

  const { error } = await resend.emails.send({
    from:    `GetEmpleos <${FROM}>`,
    to:      opts.to,
    subject: STATUS_SUBJECTS[opts.newStatus] ?? `Actualización: ${opts.jobTitle}`,
    html,
  });

  if (error) {
    console.error("[email] Error enviando StatusChanged:", error);
  }
}
