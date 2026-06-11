import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GetEmpleos — Portal de Empleo | Get Company",
  description:
    "Encuentra las mejores oportunidades laborales con Get Company, empresa colombiana líder en gestión humana y servicios temporales.",
  keywords: "empleos, trabajo, vacantes, Colombia, recursos humanos, Get Company",
  openGraph: {
    title: "GetEmpleos — Portal de Empleo | Get Company",
    description: "Encuentra las mejores oportunidades laborales con Get Company.",
    locale: "es_CO",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${plusJakarta.variable} ${sora.variable}`}>
      <body className="font-sans antialiased bg-brand-light text-brand-navy">
        {children}
      </body>
    </html>
  );
}
