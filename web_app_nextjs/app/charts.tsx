"use client";
// Gráficos interativos com Recharts (client component), estilizados premium.
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { moeda } from "@/lib/metrics";

type Etapa = { etapa: string; quantidade: number; valor_potencial: number; valor_ponderado: number };

const AZUL = "#2E75B6";
const CIANO = "#38BDF8";
const AZUL_ESCURO = "#1F3864";
const VERDE = "#22C55E";
const VERMELHO = "#F43F5E";

const tooltipStyle = {
  background: "rgba(255,255,255,0.95)",
  border: "1px solid #E2E9F3",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(15,30,59,0.14)",
  fontSize: 13,
};

const h2: React.CSSProperties = { color: "#1F3864", fontSize: 15, fontWeight: 700, margin: "0 0 14px" };

export default function Charts({ etapas, ganhas, perdidas }: { etapas: Etapa[]; ganhas: number; perdidas: number }) {
  const abertas = etapas.filter((e) => !["Ganho", "Perdido"].includes(e.etapa));
  const ponderada = etapas.filter((e) => e.etapa !== "Perdido");
  const conversao = [
    { nome: "Ganhas", valor: ganhas },
    { nome: "Perdidas", valor: perdidas },
  ];
  const cores = [VERDE, VERMELHO];

  return (
    <section className="elo-charts">
      <div className="elo-card">
        <h2 style={h2}>Pipeline por etapa</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={abertas} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="gradBar1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CIANO} />
                <stop offset="100%" stopColor={AZUL} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF3FA" vertical={false} />
            <XAxis dataKey="etapa" fontSize={11} tickLine={false} axisLine={{ stroke: "#E2E9F3" }} tick={{ fill: "#51607A" }} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#8695AE" }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(46,117,182,0.06)" }} />
            <Bar dataKey="quantidade" name="Oportunidades" fill="url(#gradBar1)" radius={[8, 8, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="elo-card">
        <h2 style={h2}>Previsão ponderada por etapa</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={ponderada} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
            <defs>
              <linearGradient id="gradBar2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AZUL} />
                <stop offset="100%" stopColor={AZUL_ESCURO} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF3FA" vertical={false} />
            <XAxis dataKey="etapa" fontSize={11} tickLine={false} axisLine={{ stroke: "#E2E9F3" }} tick={{ fill: "#51607A" }} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#8695AE" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(31,56,100,0.06)" }} formatter={(v: number) => [moeda(v), "Ponderado"]} />
            <Bar dataKey="valor_ponderado" name="Ponderado" fill="url(#gradBar2)" radius={[8, 8, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="elo-card" style={{ gridColumn: "1 / -1" }}>
        <h2 style={h2}>Conversão</h2>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={conversao} dataKey="valor" nameKey="nome" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">
              {conversao.map((_, i) => <Cell key={i} fill={cores[i]} />)}
            </Pie>
            <Legend iconType="circle" />
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
