// Página de Dashboards: conversão, funil, mapa de leads e todos os números.
// Server component — busca oportunidades, clientes e interações respeitando RLS.
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { resumo, type Oportunidade } from "@/lib/metrics";
import {
  funilConversao, conversaoPorResponsavel, porSegmento, porUf,
  interacoesPorCanal, timelineInteracoes, leadsGeo,
  type Cliente, type Interacao,
} from "@/lib/dashboard-stats";
import DashCharts, { KpiAnimado } from "./charts";
import MapaLeads from "./mapa";
import SairButton from "../sair-button";
import Logo from "../logo";
import { IconVoltar, IconClientes, IconInteracoes, IconPropostas, IconAssistente } from "../icons";

export const dynamic = "force-dynamic";

export default async function Dashboards() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/");
  }
  const supabase = supabaseServer();
  let user = null;
  try { const { data } = await supabase.auth.getUser(); user = data.user; } catch { user = null; }
  if (!user) redirect("/login");

  // Busca em paralelo (RLS filtra por permissão).
  const [opsRes, cliRes, intRes] = await Promise.all([
    supabase.from("oportunidades").select("id,cliente_nome,responsavel_nome,etapa,status,valor_potencial,probabilidade,proxima_acao,data_proxima_acao"),
    supabase.from("clientes").select("id,empresa,cidade,uf,segmento,criado_em"),
    supabase.from("interacoes").select("canal,direcao,data_interacao"),
  ]);

  const ops = (opsRes.data || []) as Oportunidade[];
  const clientes = (cliRes.data || []) as Cliente[];
  const inter = (intRes.data || []) as Interacao[];

  const r = resumo(ops);
  const funil = funilConversao(ops);
  const responsaveis = conversaoPorResponsavel(ops);
  const segmentos = porSegmento(clientes);
  const ufs = porUf(clientes);
  const canais = interacoesPorCanal(inter);
  const timeline = timelineInteracoes(inter);
  const { pontos, semCoordenada } = leadsGeo(clientes);

  const ticketMedio = r.ganhas > 0 ? r.potencial / Math.max(1, ops.length) : 0;

  return (
    <main className="elo-main">
      <header className="elo-header">
        <div className="elo-brand"><Logo height={40} /></div>
        <div className="elo-actions">
          <Link href="/" className="elo-link"><IconVoltar /> Painel</Link>
          <Link href="/clientes" className="elo-link"><IconClientes /> Clientes</Link>
          <Link href="/interacoes" className="elo-link"><IconInteracoes /> Interações</Link>
          <Link href="/propostas" className="elo-link"><IconPropostas /> Propostas</Link>
          <Link href="/assistente" className="elo-link elo-link--primary"><IconAssistente /> Assistente</Link>
          <span className="elo-email" style={{ color: "var(--txt-2)", fontSize: 13 }}>{user.email}</span>
          <SairButton />
        </div>
      </header>

      <div style={{ margin: "4px 0 14px" }}>
        <h1 style={{ fontSize: 22, margin: 0, color: "var(--txt)" }}>Dashboards</h1>
        <p style={{ margin: "4px 0 0", color: "var(--txt-2)", fontSize: 14 }}>
          Conversão, pipeline, mapa de leads e indicadores da sua carteira.
        </p>
      </div>

      {/* KPIs animados */}
      <section className="elo-kpis">
        <KpiAnimado valor={r.potencial} rotulo="Pipeline potencial" formato="moeda" />
        <KpiAnimado valor={r.ponderado} rotulo="Previsão ponderada" formato="moeda" cor="#22C55E" />
        <KpiAnimado valor={r.abertas} rotulo="Oportunidades abertas" />
        <KpiAnimado valor={r.conv ?? 0} rotulo="Taxa de conversão" formato="pct" />
        <KpiAnimado valor={r.ganhas} rotulo="Negócios ganhos" cor="#22C55E" />
        <KpiAnimado valor={r.risco} rotulo="Em risco" cor={r.risco ? "#F43F5E" : undefined} />
        <KpiAnimado valor={clientes.length} rotulo="Clientes na base" />
        <KpiAnimado valor={inter.length} rotulo="Interações registradas" />
        <KpiAnimado valor={Math.round(ticketMedio)} rotulo="Ticket médio (potencial)" formato="moeda" />
        <KpiAnimado valor={ufs.length} rotulo="Estados atendidos" />
      </section>

      {/* Gráficos animados */}
      <DashCharts
        funil={funil}
        responsaveis={responsaveis}
        segmentos={segmentos}
        ufs={ufs}
        canais={canais}
        timeline={timeline}
        ganhas={r.ganhas}
        perdidas={r.perdidas}
      />

      {/* Mapa de leads */}
      <div style={{ marginTop: 16 }}>
        <MapaLeads pontos={pontos} semCoordenada={semCoordenada} />
      </div>
    </main>
  );
}
