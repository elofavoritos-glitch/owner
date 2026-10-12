"use client";
// Botão de ajuda contextual: abre um modal simples com o conteúdo passado.
import { useState, type ReactNode } from "react";

export default function AjudaButton({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);

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

      {aberto && (
        <div
          onClick={() => setAberto(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(31,56,100,0.45)",
            display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, maxWidth: 560, width: "100%",
              maxHeight: "85vh", overflowY: "auto", padding: 24, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ color: "#1F3864", margin: 0, fontSize: 18 }}>{titulo}</h2>
              <button
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#90A4AE", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#334155" }}>{children}</div>
            <button
              onClick={() => setAberto(false)}
              style={{ marginTop: 18, width: "100%", padding: 12, background: "#1F3864", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer" }}
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
