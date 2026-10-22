"use client";
// Dashboards de conversão: KPIs com contagem animada + gráficos Recharts
// (animações nativas) seguindo o design system glassmorphism da ELO.
import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, FunnelChart, Funnel, LabelList, LineChart, Line, CartesianGrid,
} from "recharts";

const AZUL = "#2E75B6", CIANO = "#38BDF8", AZUL_ESCURO = "#1F3864";
const VERDE = "#22C55E", VERMELHO = "#F43F5E", AMBAR = "#F59E0B";
const PALETA = [AZUL, CIANO, VERDE, AMBAR, "#8B5CF6", "#EC4899", AZUL_ESCURO, "#14B8A6"];

const tooltipStyle = {
  background: "rgba(255,255,255,0.92)", border: "1px solid rgba(46,117,182,0.25)",
  borderRadius: 12, boxShadow: "0 8px 30px rgba(11,30,59,0.12)", fontSize: 13,
};
const moedaK = (v: number) => "R$ " + (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "k";

// ---------- KPI com contagem animada ----------
function useContador(alvo: number, dur = 1100) {
  const [v, setV] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    const inicio = performance.now();
    const passo = (t: number) => {
      const p = Math.min((t - inicio) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setV(alvo * eased);
      if (p < 1) ref.current = requestAnimationFrame(passo);
    };
    ref.current = requestAnimationFrame(passo);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [alvo, dur]);
  return v;
}

export function KpiAnimado({ valor, rotulo, formato = "num", cor }: {
  valor: number; rotulo: string; formato?: "num" | "moeda" | "pct"; cor?: string;
}) {
  const v = useContador(valor);
  const texto =
    formato === "moeda" ? "R$ " + Math.round(v).toLocaleString("pt-BR")
    : formato === "pct" ? Math.round(v) + "%"
    : Math.round(v).toLocaleString("pt-BR");
  return (
    <div className="elo-kpi elo-kpi--anim">
      <div className="elo-kpi__v" style={cor ? { color: cor } : undefined}>{texto}</div>
      <div className="elo-kpi__l">{rotulo}</div>
    </div>
  );
}

type FunilItem = { etapa: string; quantidade: number; valor: number; taxa: number };
type RespItem = { nome: string; valor: number; ponderado: number; conv: number | null; ganhas: number; perdidas: number };
type ParItem = { segmento?: string; uf?: string; canal?: string; quantidade: number };
type TimelineItem = { rotulo: string; quantidade: number };

export default function DashCharts({ funil, responsaveis, segmentos, ufs, canais, timeline, ganhas, perdidas }: {
  funil: FunilItem[];
  responsaveis: RespItem[];
  segmentos: ParItem[];
  ufs: ParItem[];
  canais: ParItem[];
  timeline: TimelineItem[];
  ganhas: number;
  perdidas: number;
}) {
  const funilData = funil.map((f) => ({ name: f.etapa, value: f.quantidade, taxa: f.taxa, fill: PALETA[0] }));
  const conv = [
    { name: "Ganhas", value: ganhas, fill: VERDE },
    { name: "Perdidas", value: perdidas, fill: VERMELHO },
  ];

  return (
    <div className="elo-dash-grid">
      {/* Funil de conversão */}
      <div className="elo-card elo-dash-card">
        <h3 className="elo-dash-h">Funil de conversão</h3>
        <ResponsiveContainer width="100%" height={260}>
          <FunnelChart>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number, _n, p) => [`${v} oportunidades (${(p?.payload as FunilItem)?.taxa ?? 0}% do topo)`, (p?.payload as { name?: string })?.name ?? ""]} />
            <Funnel dataKey="value" data={funilData} isAnimationActive animationDuration={1200} stroke="#fff">
              {funilData.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
              <LabelList position="right" fill="#334155" stroke="none" dataKey="name" fontSize={12} />
              <LabelList position="center" fill="#fff" stroke="none" dataKey="value" fontSize={14} fontWeight={700} />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>

      {/* Conversão (donut) */}
      <div className="elo-card elo-dash-card">
        <h3 className="elo-dash-h">Ganhas × Perdidas</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} />
            <Pie data={conv} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3}
              isAnimationActive animationDuration={1100} label={(e) => `${e.name}: ${e.value}`}>
              {conv.map((c, i) => <Cell key={i} fill={c.fill} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Valor por responsável */}
      <div className="elo-card elo-dash-card">
        <h3 className="elo-dash-h">Pipeline por responsável</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={responsaveis} layout="vertical" margin={{ left: 10, right: 20 }}>
            <defs>
              <linearGradient id="gradResp" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={CIANO} /><stop offset="100%" stopColor={AZUL} />
              </linearGradient>
            </defs>
            <XAxis type="number" tickFormatter={moedaK} fontSize={11} stroke="#8695AE" />
            <YAxis type="category" dataKey="nome" width={110} fontSize={11} stroke="#8695AE" />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => moedaK(v)} />
            <Bar dataKey="valor" fill="url(#gradResp)" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={1100} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Interações no tempo (linha) */}
      <div className="elo-card elo-dash-card">
        <h3 className="elo-dash-h">Interações (6 meses)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={timeline} margin={{ left: -10, right: 10 }}>
            <defs>
              <linearGradient id="gradLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={AZUL} /><stop offset="100%" stopColor={CIANO} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(46,117,182,0.1)" />
            <XAxis dataKey="rotulo" fontSize={11} stroke="#8695AE" />
            <YAxis fontSize={11} stroke="#8695AE" allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="quantidade" stroke="url(#gradLine)" strokeWidth={3}
              dot={{ r: 4, fill: AZUL }} activeDot={{ r: 6 }} isAnimationActive animationDuration={1200} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Clientes por segmento */}
      <div className="elo-card elo-dash-card">
        <h3 className="elo-dash-h">Clientes por segmento</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={segmentos} margin={{ left: -10, right: 10, bottom: 30 }}>
            <XAxis dataKey="segmento" fontSize={10} stroke="#8695AE" angle={-20} textAnchor="end" interval={0} height={50} />
            <YAxis fontSize={11} stroke="#8695AE" allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="quantidade" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={1100}>
              {segmentos.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Interações por canal */}
      <div className="elo-card elo-dash-card">
        <h3 className="elo-dash-h">Interações por canal</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} />
            <Pie data={canais} dataKey="quantidade" nameKey="canal" outerRadius={95} paddingAngle={2}
              isAnimationActive animationDuration={1100} label={(e) => `${e.canal}`}>
              {canais.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
