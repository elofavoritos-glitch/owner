"use client";
// Botão de ajuda contextual: abre um modal com o conteúdo passado.
// O modal é renderizado via portal no <body> para escapar do contexto de
// empilhamento do cabeçalho (que usa backdrop-filter) — senão abre cortado.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function AjudaButton({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);

  // Trava o scroll do fundo enquanto o modal está aberto.
  useEffect(() => {
    if (aberto) {
      const anterior = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = anterior; };
    }
  }, [aberto]);

  const modal = (
    <div
      onClick={() => setAberto(false)}
      style={{ position: "fixed", inset: 0, background: "rgba(11,30,59,0.55)",
        backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
        display: "grid", placeItems: "center", padding: 16, zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 18, maxWidth: 560, width: "100%",
          maxHeight: "85vh", overflowY: "auto", padding: 24,
          boxShadow: "0 24px 60px rgba(11,30,59,0.35)", border: "1px solid rgba(255,255,255,0.9)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ color: "#1F3864", margin: 0, fontSize: 18 }}>{titulo}</h2>
          <button
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            style={{ background: "none", border: "none", fontSize: 26, cursor: "pointer", color: "#8695AE", lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: "#334155" }}>{children}</div>
        <button onClick={() => setAberto(false)} className="elo-btn" style={{ marginTop: 18, width: "100%" }}>
          Entendi
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        title="Ajuda"
        aria-label="Ajuda"
        className="elo-link"
        style={{ background: "rgba(255,255,255,.7)", border: "1px solid var(--glass-borda)", cursor: "pointer" }}
      >
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
        Ajuda
      </button>

      {aberto && montado ? createPortal(modal, document.body) : null}
    </>
  );
}
