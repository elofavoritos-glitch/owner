"use client";
// Logo da ELO. Usa o arquivo oficial em /public/elo-logo.png se ele existir;
// caso contrário, cai para um símbolo SVG de reserva.
//
// Para usar o logo oficial: coloque o arquivo em
//   web_app_nextjs/public/elo-logo.png
// (pode subir pela interface do GitHub em web_app_nextjs/public/).
import { useState } from "react";

function LogoFallbackSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-label="ELO" role="img">
      <defs>
        <linearGradient id="eloGradClaro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7FC4F0" /><stop offset="1" stopColor="#BFE2F7" />
        </linearGradient>
        <linearGradient id="eloGradEscuro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1F3864" /><stop offset="1" stopColor="#2E75B6" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#eloGradClaro)" />
      <path d="M50 6 a44 44 0 1 0 24 80 a34 34 0 1 1 -18 -70 a44 44 0 0 0 -6 -10 z"
        fill="url(#eloGradEscuro)" opacity="0.95" />
      <circle cx="36" cy="32" r="10" fill="#FFFFFF" opacity="0.22" />
    </svg>
  );
}

export default function Logo({ size = 34 }: { size?: number }) {
  const [erro, setErro] = useState(false);
  if (erro) return <LogoFallbackSVG size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/elo-logo.png"
      alt="ELO"
      width={size}
      height={size}
      style={{ objectFit: "contain", display: "block" }}
      onError={() => setErro(true)}
    />
  );
}
