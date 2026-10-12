"use client";
// Logo oficial da ELO (horizontal, com o nome). Arquivo em /public/elo-logo.png.
// Proporção original: 460x158. Fallback para um símbolo SVG se o arquivo faltar.
import { useState } from "react";

function LogoFallbackSVG({ height }: { height: number }) {
  const s = height;
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" fill="none" aria-label="ELO" role="img">
      <defs>
        <linearGradient id="eloGradClaro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7FC4F0" /><stop offset="1" stopColor="#BFE2F7" />
        </linearGradient>
        <linearGradient id="eloGradEscuro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1F3864" /><stop offset="1" stopColor="#2E75B6" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#eloGradClaro)" />
      <path d="M50 6 a44 44 0 1 0 24 80 a34 34 0 1 1 -18 -70 a44 44 0 0 0 -6 -10 z" fill="url(#eloGradEscuro)" opacity="0.95" />
    </svg>
  );
}

// `height` controla a altura do logo; a largura é proporcional (460/158 ≈ 2.91).
export default function Logo({ height = 42 }: { height?: number }) {
  const [erro, setErro] = useState(false);
  if (erro) return <LogoFallbackSVG height={height} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/elo-logo.png"
      alt="ELO Soluções Logísticas Integradas"
      height={height}
      style={{ height, width: "auto", display: "block" }}
      onError={() => setErro(true)}
    />
  );
}
