"use client";
// Gráficos interativos com Recharts (client component).
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { moeda } from "@/lib/metrics";

type Etapa = { etapa: string; quantidade: number; valor_potencial: number; valor_ponderado: number };

export default function Charts({ etapas, ganhas, perdidas }: { etapas: Etapa[]; ganhas: number; perdidas: number }) {
  const abertas = etapas.filter((e) => !["Ganho", "Perdido"].includes(e.etapa));
  const conversao = [
    { nome: "Ganhas", valor: ganhas },
    { nome: "Perdidas", valor: perdidas },
  ];
  const cores = ["#70AD47", "#C0392B"];

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #E3E8F0", borderRadius: 12, padding: 18 };

  return (
    <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={card}>
        <h2 style={{ color: "#1F3864", fontSize: 15 }}>Pipeline por etapa</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={abertas}>
            <XAxis dataKey="etapa" fontSize={11} /><YAxis fontSize={11} />
            <Tooltip /><Bar dataKey="quantidade" fill="#2E75B6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={card}>
        <h2 style={{ color: "#1F3864", fontSize: 15 }}>Previsão ponderada por etapa</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={etapas.filter((e) => e.etapa !== "Perdido")}>
            <XAxis dataKey="etapa" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v: number) => moeda(v)} />
            <Bar dataKey="valor_ponderado" fill="#1F3864" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={card}>
        <h2 style={{ color: "#1F3864", fontSize: 15 }}>Conversão</h2>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={conversao} dataKey="valor" nameKey="nome" innerRadius={60} outerRadius={90}>
              {conversao.map((_, i) => <Cell key={i} fill={cores[i]} />)}
            </Pie>
            <Legend /><Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
