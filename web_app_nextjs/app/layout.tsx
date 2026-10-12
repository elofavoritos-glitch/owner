import type { Viewport } from "next";
import "./globals.css";

export const metadata = { title: "ELO — Painel Comercial", description: "Dashboards comerciais da ELO" };

// Essencial para responsividade: faz o celular renderizar na largura real.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1F3864",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#F4F6FA", fontFamily: "Segoe UI, system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
