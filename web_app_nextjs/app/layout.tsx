export const metadata = { title: "ELO — Painel Comercial", description: "Dashboards comerciais da ELO" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#F4F6FA", fontFamily: "Segoe UI, system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
