"use client";
import { useEffect, useState, useRef } from "react";

type Documento = {
  id: string;
  tipo: string;
  nome_arquivo: string;
  tamanho_bytes: number | null;
  responsavel_nome: string | null;
  criado_em: string;
};

const TIPOS = [
  { v: "planilha", l: "Planilha" },
  { v: "contrato", l: "Contrato" },
  { v: "cartao_cnpj", l: "Cartão CNPJ" },
  { v: "danfe", l: "DANFE" },
  { v: "nfe", l: "NF-e" },
  { v: "nfse", l: "NFS-e" },
  { v: "duimp", l: "DUIMP" },
  { v: "outro", l: "Outro" },
];
const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.v, t.l]));

function tamanho(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function Documentos({ clienteId, empresa }: { clienteId: string; empresa: string }) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [tipo, setTipo] = useState("outro");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await fetch(`/api/documentos?cliente_id=${clienteId}`);
      const d = await r.json();
      setDocs(d.documentos ?? []);
    } catch {
      /* silencioso */
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("cliente_id", clienteId);
      fd.append("empresa", empresa);
      fd.append("tipo", tipo);
      const r = await fetch("/api/documentos", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) setMsg({ tipo: "erro", texto: d.erro || "Falha no upload." });
      else { setMsg({ tipo: "ok", texto: "Documento anexado!" }); carregar(); }
    } catch {
      setMsg({ tipo: "erro", texto: "Erro de conexão." });
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este documento?")) return;
    const r = await fetch(`/api/documentos?id=${id}`, { method: "DELETE" });
    if (r.ok) carregar();
  }

  return (
    <div style={{ marginTop: 16, borderTop: "1px dashed #D6DEEA", paddingTop: 14 }}>
      <h3 style={{ color: "#1F3864", fontSize: 14, margin: "0 0 10px" }}>
        Documentos de {empresa}
      </h3>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}
          style={{ padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13 }}>
          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <input ref={inputRef} type="file" onChange={enviar} disabled={enviando}
          style={{ fontSize: 13 }} />
        {enviando && <span style={{ fontSize: 12, color: "#90A4AE" }}>enviando…</span>}
      </div>
      {msg && <p style={{ fontSize: 12, marginTop: 8, color: msg.tipo === "ok" ? "#2E7D32" : "#C0392B" }}>{msg.texto}</p>}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {carregando ? (
          <p style={{ color: "#90A4AE", fontSize: 13 }}>Carregando…</p>
        ) : docs.length === 0 ? (
          <p style={{ color: "#90A4AE", fontSize: 13 }}>Nenhum documento anexado.</p>
        ) : (
          docs.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              gap: 8, border: "1px solid #EEF2F8", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ background: "#EEF2F8", color: "#1F3864", borderRadius: 6, padding: "1px 6px",
                    fontSize: 11, marginRight: 6 }}>{TIPO_LABEL[d.tipo] ?? d.tipo}</span>
                  {d.nome_arquivo}
                </div>
                <div style={{ fontSize: 11, color: "#90A4AE", marginTop: 2 }}>
                  {tamanho(d.tamanho_bytes)}{d.responsavel_nome ? ` · ${d.responsavel_nome}` : ""} · {d.criado_em.slice(0, 10).split("-").reverse().join("/")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <a href={`/api/documentos/download?id=${d.id}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: "#2E75B6", textDecoration: "none", border: "1px solid #D6DEEA",
                    borderRadius: 6, padding: "4px 8px" }}>abrir</a>
                <button onClick={() => excluir(d.id)}
                  style={{ fontSize: 12, color: "#C0392B", background: "none", border: "1px solid #F0D0CC",
                    borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>excluir</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
