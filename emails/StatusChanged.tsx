import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Preview,
} from "@react-email/components";

type ApplicationStatus = "reviewing" | "shortlisted" | "rejected" | "hired";

interface StatusChangedProps {
  candidateName: string;
  jobTitle:      string;
  newStatus:     ApplicationStatus;
  dashboardUrl:  string;
}

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; color: string; message: string; emoji: string }
> = {
  reviewing: {
    label:   "En revisión",
    color:   "#2D5BE3",
    emoji:   "🔍",
    message:
      "Tu hoja de vida está siendo revisada por nuestro equipo de selección. Pronto te contactaremos con más información.",
  },
  shortlisted: {
    label:   "Preseleccionado",
    color:   "#7C4DFF",
    emoji:   "⭐",
    message:
      "¡Excelentes noticias! Tu perfil ha sido preseleccionado. Un miembro de nuestro equipo se pondrá en contacto contigo próximamente para continuar el proceso.",
  },
  rejected: {
    label:   "No continúa",
    color:   "#EF4444",
    emoji:   "📋",
    message:
      "Gracias por participar en nuestro proceso. En esta oportunidad tu perfil no continuará con el proceso para esta vacante. Te invitamos a postularte a otras ofertas que puedan ajustarse mejor a tu perfil.",
  },
  hired: {
    label:   "Contratado",
    color:   "#3DBE8C",
    emoji:   "🎉",
    message:
      "¡Felicitaciones! Has sido seleccionado para el cargo. Nuestro equipo de Recursos Humanos te contactará para coordinar los trámites de contratación. ¡Bienvenido a la familia Get Company!",
  },
};

export default function StatusChanged({
  candidateName,
  jobTitle,
  newStatus,
  dashboardUrl,
}: StatusChangedProps) {
  const config = STATUS_CONFIG[newStatus];

  return (
    <Html lang="es">
      <Head />
      <Preview>
        {config.emoji} Actualización de tu postulación a {jobTitle}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={logoText}>
              Get<span style={{ color: "#F5A623" }}>Empleos</span>
            </Heading>
          </Section>

          {/* Estado badge */}
          <Section style={{ ...statusBanner, backgroundColor: config.color + "20", borderColor: config.color + "40" }}>
            <Text style={{ ...statusLabel, color: config.color }}>
              {config.emoji} {config.label}
            </Text>
          </Section>

          {/* Contenido */}
          <Section style={content}>
            <Heading as="h2" style={h2}>
              Actualización de tu postulación
            </Heading>

            <Text style={greeting}>Hola {candidateName},</Text>

            <Text style={text}>
              Queremos informarte que el estado de tu postulación a{" "}
              <strong style={{ color: "#1B2A4A" }}>{jobTitle}</strong> ha
              sido actualizado.
            </Text>

            <Section style={{ ...statusBox, borderColor: config.color }}>
              <Text style={statusBoxText}>{config.message}</Text>
            </Section>

            <Button style={{ ...button, backgroundColor: config.color }} href={dashboardUrl}>
              Ver detalle de mi postulación
            </Button>

            <Hr style={hr} />

            <Text style={footer}>
              ¿Tienes preguntas? Escríbenos a{" "}
              <a href="mailto:empleos@getcompany.co" style={link}>
                empleos@getcompany.co
              </a>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Get Company · Colombia
            </Text>
            <Text style={footerText}>
              getcompany.co · Empresa de gestión humana y servicios temporales
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const main: React.CSSProperties = {
  backgroundColor: "#F5F7FA",
  fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "32px auto",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  backgroundColor: "#1B2A4A",
  padding: "24px 32px",
};

const logoText: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: "700",
  margin: 0,
};

const statusBanner: React.CSSProperties = {
  padding: "12px 32px",
  borderBottom: "1px solid",
};

const statusLabel: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "700",
  margin: 0,
};

const content: React.CSSProperties = {
  padding: "32px",
};

const h2: React.CSSProperties = {
  color: "#1B2A4A",
  fontSize: "20px",
  fontWeight: "700",
  marginBottom: "16px",
  marginTop: 0,
};

const greeting: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  marginBottom: "8px",
};

const text: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "14px",
  lineHeight: "22px",
  marginBottom: "16px",
};

const statusBox: React.CSSProperties = {
  borderLeft: "3px solid",
  paddingLeft: "16px",
  marginBottom: "24px",
};

const statusBoxText: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "22px",
  margin: 0,
};

const button: React.CSSProperties = {
  color: "#ffffff",
  borderRadius: "10px",
  padding: "12px 28px",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  display: "inline-block",
  marginBottom: "24px",
};

const hr: React.CSSProperties = {
  borderColor: "#E5E7EB",
  marginBottom: "16px",
};

const footer: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
};

const link: React.CSSProperties = {
  color: "#2D5BE3",
  textDecoration: "underline",
};

const footerSection: React.CSSProperties = {
  backgroundColor: "#F5F7FA",
  padding: "16px 32px",
  textAlign: "center",
};

const footerText: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "11px",
  margin: "2px 0",
};
