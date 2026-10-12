"use client";
import { useRef, useState } from "react";

type Previa = {
  destino: string;
  cabecalhos: string[];
  mapa: Record<string, string | null>;
  campo_obrigatorio: string;
  total_linhas: number;
  validos: number;
  ignoradas: number;
  amostra: Record<string, unknown>[];
};

export default function ImportarPlanilha({ aoImportar }: { aoImportar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [destino, setDestino] = useState<"clientes" | "oportunidades">("clientes");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setArquivo(null); setPrevia(null); setMsg(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function gerarPrevia(file: File) {
    setCarregando(true); setMsg(null); setPrevia(null);
    try {
      const fd = new FormData();
      fd.append("acao", "previa");
      fd.append("destino", destino);
      fd.append("file", file);
      const r = await fetch("/api/importar", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) setMsg({ tipo: "erro", texto: d.erro || "Falha ao ler a planilha." });
      else setPrevia(d);
    } catch {
      setMsg({ tipo: "erro", texto: "Erro de conexão." });
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    if (!arquivo || !previa) return;
    setCarregando(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("acao", "confirmar");
      fd.append("destino", destino);
      fd.append("file", arquivo);
      fd.append("mapa", JSON.stringify(previa.mapa));
      const r = await fetch("/api/importar", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) setMsg({ tipo: "erro", texto: d.erro || "Falha ao importar." });
      else {
        setMsg({ tipo: "ok", texto: `${d.inseridos} registro(s) importado(s)! ${d.ignoradas ? d.ignoradas + " ignorado(s)." : ""}` });
        reset();
        aoImportar();
      }
    } catch {
      setMsg({ tipo: "erro", texto: "Erro de conexão." });
    } finally {
      setCarregando(false);
    }
  }

  const campoMapeado = (previa: Previa) =>
    Object.entries(previa.mapa).filter(([, c]) => c);

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)}
        style={{ padding: "9px 14px", background: "#70AD47", color: "#fff", border: "none",
          borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
        ⬆️ Importar planilha
      </button>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #E3E8F0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ color: "#1F3864", fontSize: 16, margin: 0 }}>Importar planilha (.xlsx / .csv)</h2>
        <button onClick={() => { setAberto(false); reset(); }}
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#90A4AE" }}>×</button>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        <label style={{ fontSize: 13, color: "#607D8B" }}>Importar para:</label>
        <select value={destino} onChange={(e) => { setDestino(e.target.value as "clientes" | "oportunidades"); reset(); }}
          style={{ padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13 }}>
          <option value="clientes">Clientes</option>
          <option value="oportunidades">Oportunidades</option>
        </select>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv"
          onChange={(e) => { const f = e.target.files?.[0] || null; setArquivo(f); if (f) gerarPrevia(f); }}
          style={{ fontSize: 13 }} />
        {carregando && <span style={{ fontSize: 12, color: "#90A4AE" }}>processando…</span>}
      </div>

      {msg && <p style={{ fontSize: 13, marginTop: 10, color: msg.tipo === "ok" ? "#2E7D32" : "#C0392B" }}>{msg.texto}</p>}

      {previa && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 13, color: "#334155", margin: "0 0 8px" }}>
            <strong>{previa.validos}</strong> de {previa.total_linhas} linha(s) prontas para importar
            {previa.ignoradas ? ` (${previa.ignoradas} sem "${previa.campo_obrigatorio}" serão ignoradas)` : ""}.
          </p>

          <div style={{ fontSize: 12, color: "#607D8B", marginBottom: 8 }}>
            <strong>Colunas reconhecidas:</strong>{" "}
            {campoMapeado(previa).map(([cab, campo]) => `${cab} → ${campo}`).join("  ·  ") || "nenhuma"}
          </div>

          {/* Amostra */}
          {previa.amostra.length > 0 && (
            <div style={{ overflowX: "auto", border: "1px solid #EEF2F8", borderRadius: 8 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
                <thead>
                  <tr>
                    {Object.keys(previa.amostra[0]).map((k) => (
                      <th key={k} style={{ textAlign: "left", padding: "6px 10px", background: "#F4F6FA",
                        color: "#1F3864", borderBottom: "1px solid #E3E8F0", whiteSpace: "nowrap" }}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previa.amostra.map((r, i) => (
                    <tr key={i}>
                      {Object.keys(previa.amostra[0]).map((k) => (
                        <td key={k} style={{ padding: "6px 10px", borderBottom: "1px solid #F4F6FA", whiteSpace: "nowrap" }}>
                          {String(r[k] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button onClick={confirmar} disabled={carregando || previa.validos === 0}
            style={{ marginTop: 14, padding: "11px 20px", background: "#1F3864", color: "#fff", border: "none",
              borderRadius: 8, fontSize: 14, cursor: "pointer", opacity: carregando || previa.validos === 0 ? 0.6 : 1 }}>
            Confirmar e importar {previa.validos} registro(s)
          </button>
        </div>
      )}
    </div>
  );
}
