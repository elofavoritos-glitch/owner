"use client";
// Mapa de leads do Brasil em SVG puro (sem lib de mapa). Projeta as coordenadas
// [lon,lat] das cidades num viewBox e plota bolhas pulsantes proporcionais à
// quantidade de leads. Foco na região sul/sudeste (operação da ELO).
import { useState } from "react";
import type { LeadGeo } from "@/lib/dashboard-stats";

// Bounding box do Brasil (continental) em graus.
const LON_MIN = -74, LON_MAX = -34.5;
const LAT_MIN = -34, LAT_MAX = 5.5;
const W = 440, H = 460;

function projetar(lon: number, lat: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
  return [x, y];
}

// Contorno simplificado do Brasil (path aproximado, só para dar referência
// visual — não é cartografia precisa).
const BRASIL_PATH =
  "M 210 40 L 250 55 L 275 50 L 300 70 L 320 95 L 330 130 L 360 150 L 380 185 " +
  "L 375 220 L 350 245 L 355 280 L 335 310 L 345 345 L 320 375 L 300 400 L 270 420 " +
  "L 240 430 L 215 415 L 200 385 L 175 370 L 160 340 L 140 320 L 120 290 L 110 255 " +
  "L 95 225 L 80 190 L 95 160 L 120 140 L 140 120 L 150 90 L 175 65 L 210 40 Z";

export default function MapaLeads({ pontos, semCoordenada }: { pontos: LeadGeo[]; semCoordenada: number }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const maxQ = Math.max(1, ...pontos.map((p) => p.quantidade));
  const totalLeads = pontos.reduce((s, p) => s + p.quantidade, 0);

  return (
    <div className="elo-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "var(--txt)" }}>Mapa de leads</h3>
        <span style={{ fontSize: 12, color: "var(--txt-3)" }}>
          {totalLeads} {totalLeads === 1 ? "lead localizado" : "leads localizados"}
          {semCoordenada > 0 && ` · ${semCoordenada} sem cidade mapeada`}
        </span>
      </div>

      {pontos.length === 0 ? (
        <p style={{ color: "var(--txt-3)", fontSize: 14, padding: "32px 0", textAlign: "center" }}>
          Nenhum lead com cidade reconhecida ainda. Cadastre clientes com cidade (ex.: Itajaí, Curitiba, São Paulo) para vê-los no mapa.
        </p>
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 400, height: "auto" }} role="img" aria-label="Mapa de leads no Brasil">
            <defs>
              <radialGradient id="mapaBolha" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#2E75B6" stopOpacity="0.75" />
              </radialGradient>
            </defs>
            <path d={BRASIL_PATH} fill="rgba(46,117,182,0.08)" stroke="rgba(46,117,182,0.35)" strokeWidth="1.5" />
            {pontos.map((p, i) => {
              const [x, y] = projetar(p.lon, p.lat);
              const r = 6 + (p.quantidade / maxQ) * 20;
              const destaque = ativo === p.cidade;
              return (
                <g key={p.cidade} onMouseEnter={() => setAtivo(p.cidade)} onMouseLeave={() => setAtivo(null)} style={{ cursor: "pointer" }}>
                  {/* halo pulsante */}
                  <circle cx={x} cy={y} r={r} fill="#38BDF8" opacity="0.25">
                    <animate attributeName="r" values={`${r};${r + 7};${r}`} dur="2.4s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.25;0.05;0.25" dur="2.4s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
                  </circle>
                  <circle cx={x} cy={y} r={r} fill="url(#mapaBolha)" stroke="#fff" strokeWidth={destaque ? 2.5 : 1.2} />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize={Math.min(13, 9 + p.quantidade)} fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>
                    {p.quantidade}
                  </text>
                  {destaque && (
                    <text x={x} y={y - r - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--txt)" style={{ pointerEvents: "none" }}>
                      {p.cidade}{p.uf ? `/${p.uf}` : ""}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* legenda / ranking */}
          <div style={{ minWidth: 180, flex: "1 1 180px" }}>
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Top cidades</div>
            {pontos.slice(0, 8).map((p) => (
              <div
                key={p.cidade}
                onMouseEnter={() => setAtivo(p.cidade)}
                onMouseLeave={() => setAtivo(null)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 10px", borderRadius: 10, marginBottom: 4,
                  background: ativo === p.cidade ? "rgba(56,189,248,0.14)" : "transparent",
                  transition: "background .15s",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--txt)" }}>{p.cidade}{p.uf ? `/${p.uf}` : ""}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--elo-azul-2)", fontFamily: "var(--font-mono)" }}>{p.quantidade}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
