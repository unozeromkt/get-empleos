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

interface ApplicationReceivedProps {
  candidateName: string;
  jobTitle:      string;
  jobCity:       string;
  appliedAt:     string;
  dashboardUrl:  string;
}

export default function ApplicationReceived({
  candidateName,
  jobTitle,
  jobCity,
  appliedAt,
  dashboardUrl,
}: ApplicationReceivedProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Tu postulación a {jobTitle} fue recibida ✅</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={logoText}>
              Get<span style={{ color: "#F5A623" }}>Empleos</span>
            </Heading>
          </Section>

          {/* Contenido */}
          <Section style={content}>
            <Heading as="h2" style={h2}>
              ¡Postulación recibida!
            </Heading>

            <Text style={greeting}>Hola {candidateName},</Text>

            <Text style={text}>
              Tu postulación a la oferta{" "}
              <strong style={{ color: "#1B2A4A" }}>{jobTitle}</strong>{" "}
              en <strong>{jobCity}</strong> fue enviada exitosamente el{" "}
              {appliedAt}.
            </Text>

            <Text style={text}>
              Nuestro equipo de reclutamiento revisará tu perfil y te
              notificaremos por este mismo medio cuando haya novedades sobre
              tu proceso.
            </Text>

            {/* Qué sigue */}
            <Section style={stepsContainer}>
              <Text style={stepsTitle}>¿Qué sigue?</Text>
              <div style={step}>
                <span style={stepNumber}>1</span>
                <Text style={stepText}>
                  Revisión de hoja de vida por parte del equipo de selección
                </Text>
              </div>
              <div style={step}>
                <span style={stepNumber}>2</span>
                <Text style={stepText}>
                  Contacto telefónico o por WhatsApp si tu perfil es
                  seleccionado
                </Text>
              </div>
              <div style={step}>
                <span style={stepNumber}>3</span>
                <Text style={stepText}>
                  Entrevista y proceso de contratación
                </Text>
              </div>
            </Section>

            <Button style={button} href={dashboardUrl}>
              Ver mis postulaciones
            </Button>

            <Hr style={hr} />

            <Text style={footer}>
              Si tienes dudas, escríbenos a{" "}
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

// ─── Estilos inline ────────────────────────────────────────────────────────────

const main: React.CSSProperties = {
  backgroundColor: "#F5F7FA",
  fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  overflow: "hidden",
  marginTop: "32px",
  marginBottom: "32px",
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

const content: React.CSSProperties = {
  padding: "32px",
};

const h2: React.CSSProperties = {
  color: "#1B2A4A",
  fontSize: "22px",
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

const stepsContainer: React.CSSProperties = {
  backgroundColor: "#F5F7FA",
  borderRadius: "12px",
  padding: "20px 24px",
  marginBottom: "24px",
};

const stepsTitle: React.CSSProperties = {
  color: "#1B2A4A",
  fontSize: "13px",
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "12px",
  marginTop: 0,
};

const step: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  marginBottom: "10px",
};

const stepNumber: React.CSSProperties = {
  backgroundColor: "#2D5BE3",
  color: "#ffffff",
  borderRadius: "50%",
  width: "20px",
  height: "20px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "11px",
  fontWeight: "700",
  flexShrink: 0,
};

const stepText: React.CSSProperties = {
  color: "#374151",
  fontSize: "13px",
  lineHeight: "20px",
  margin: 0,
};

const button: React.CSSProperties = {
  backgroundColor: "#2D5BE3",
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
