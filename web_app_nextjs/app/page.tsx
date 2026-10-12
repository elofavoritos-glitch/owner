// Dashboard principal (server component). Busca oportunidades respeitando o RLS
// (comercial vê a própria carteira; gestor vê o time) e renderiza os gráficos.
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { resumo, porEtapa, moeda, type Oportunidade } from "@/lib/metrics";
import Charts from "./charts";
import SairButton from "./sair-button";

// A página depende de cookies/sessão: precisa ser renderizada dinamicamente.
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = supabaseServer();

  // getUser() não deve derrubar a página se o cookie estiver ausente/inválido.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  if (!user) redirect("/login");

  const { data: ops, error } = await supabase
    .from("oportunidades")
    .select("id,cliente_nome,responsavel_nome,etapa,status,valor_potencial,probabilidade,proxima_acao,data_proxima_acao");

  if (error) {
    console.error("Erro ao buscar oportunidades:", error.message);
  }

  const oportunidades = (ops || []) as Oportunidade[];
  const r = resumo(oportunidades);
  const etapas = porEtapa(oportunidades);

  const kpis = [
    { v: moeda(r.potencial), l: "Pipeline potencial" },
    { v: moeda(r.ponderado), l: "Previsão ponderada", cor: "#70AD47" },
    { v: String(r.abertas), l: "Oportunidades abertas" },
    { v: r.conv === null ? "—" : r.conv + "%", l: "Taxa de conversão" },
    { v: String(r.risco), l: "Em risco", cor: r.risco ? "#C0392B" : undefined },
  ];

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h1 style={{ color: "#1F3864", margin: 0 }}>Painel Comercial — ELO</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#607D8B", fontSize: 13 }}>{user.email}</span>
          <SairButton />
        </div>
      </header>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, margin: "16px 0" }}>
        {kpis.map((k) => (
          <div key={k.l} style={{ background: "#fff", border: "1px solid #E3E8F0", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.cor || "#1F3864" }}>{k.v}</div>
            <div style={{ fontSize: 12, color: "#607D8B", textTransform: "uppercase" }}>{k.l}</div>
          </div>
        ))}
      </section>
      <Charts etapas={etapas} ganhas={r.ganhas} perdidas={r.perdidas} />
    </main>
  );
}
