// Dashboard principal (server component). Busca oportunidades respeitando o RLS
// (comercial vê a própria carteira; gestor vê o time) e renderiza os gráficos.
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { resumo, porEtapa, moeda, type Oportunidade } from "@/lib/metrics";
import Link from "next/link";
import Charts from "./charts";
import SairButton from "./sair-button";
import AjudaButton from "./ajuda-button";

// A página depende de cookies/sessão: precisa ser renderizada dinamicamente.
export const dynamic = "force-dynamic";

function ConfigFaltando() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: 24, fontFamily: "Segoe UI, system-ui" }}>
      <h1 style={{ color: "#C0392B" }}>Configuração incompleta</h1>
      <p style={{ color: "#334155" }}>
        As variáveis de ambiente do Supabase não estão definidas neste deploy.
        Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> em{" "}
        <strong>Vercel → Settings → Environment Variables</strong> (ambiente
        Production) e faça um novo deploy.
      </p>
      <p style={{ color: "#64748B", fontSize: 13 }}>
        Diagnóstico detalhado em <code>/api/health</code>.
      </p>
    </main>
  );
}

export default async function Dashboard() {
  // Sem env vars, o client do Supabase não pode ser criado: mostra aviso claro
  // em vez de derrubar a renderização com um erro críptico.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <ConfigFaltando />;
  }

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
          <Link
            href="/clientes"
            style={{ color: "#2E75B6", padding: "8px 10px", fontSize: 13, textDecoration: "none" }}
          >
            🏢 Clientes
          </Link>
          <Link
            href="/interacoes"
            style={{ color: "#2E75B6", padding: "8px 10px", fontSize: 13, textDecoration: "none" }}
          >
            📇 Interações
          </Link>
          <Link
            href="/assistente"
            style={{ background: "#2E75B6", color: "#fff", padding: "8px 14px", borderRadius: 8,
              fontSize: 13, textDecoration: "none", fontWeight: 600 }}
          >
            💬 Assistente
          </Link>
          <AjudaButton titulo="Como ler o Painel">
            <p>Os indicadores consideram as oportunidades que você tem permissão de ver
            (comercial: sua carteira; gestor: o time todo).</p>
            <ul>
              <li><strong>Pipeline potencial</strong> — soma do valor de todas as oportunidades.</li>
              <li><strong>Previsão ponderada</strong> — soma do valor multiplicado pela probabilidade de cada
              oportunidade (expectativa mais realista de receita).</li>
              <li><strong>Oportunidades abertas</strong> — ainda em andamento (nem ganhas, nem perdidas).</li>
              <li><strong>Taxa de conversão</strong> — ganhas ÷ (ganhas + perdidas).</li>
              <li><strong>Em risco</strong> — abertas sem próxima ação definida ou com ação atrasada.</li>
            </ul>
            <p>Use o <strong>📇 Interações</strong> para registrar contatos e o
            <strong> 💬 Assistente</strong> para consultar e analisar clientes em conversa (inclusive por voz).</p>
          </AjudaButton>
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
