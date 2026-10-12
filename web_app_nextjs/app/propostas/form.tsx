"use client";
import { useEffect, useState } from "react";

type Cliente = { id: string; empresa: string; cnpj: string | null };
type Item = { descricao: string; quantidade: string; valor_unitario: string };

export default function PropostasForm() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [itens, setItens] = useState<Item[]>([{ descricao: "", quantidade: "1", valor_unitario: "" }]);
  const [condicoes, setCondicoes] = useState("");
  const [validade, setValidade] = useState("15");
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string; docId?: string } | null>(null);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((d) => setClientes(d.clientes ?? []))
      .catch(() => {});
  }, []);

  const setItem = (i: number, k: keyof Item, v: string) =>
    setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const addItem = () => setItens((arr) => [...arr, { descricao: "", quantidade: "1", valor_unitario: "" }]);
  const delItem = (i: number) => setItens((arr) => arr.filter((_, idx) => idx !== i));

  const total = itens.reduce((s, it) => {
    const q = parseFloat(it.quantidade.replace(",", ".")) || 0;
    const v = parseFloat(it.valor_unitario.replace(/\./g, "").replace(",", ".")) || 0;
    return s + q * v;
  }, 0);

  async function gerar() {
    const cliente = clientes.find((c) => c.id === clienteId);
    if (!cliente) { setMsg({ tipo: "erro", texto: "Selecione um cliente." }); return; }
    const itensValidos = itens
      .filter((it) => it.descricao.trim())
      .map((it) => ({
        descricao: it.descricao.trim(),
        quantidade: parseFloat(it.quantidade.replace(",", ".")) || 1,
        valor_unitario: it.valor_unitario.trim()
          ? parseFloat(it.valor_unitario.replace(/\./g, "").replace(",", ".")) || 0
          : undefined,
      }));
    if (!itensValidos.length) { setMsg({ tipo: "erro", texto: "Adicione ao menos um item com descrição." }); return; }

    setGerando(true); setMsg(null);
    try {
      const r = await fetch("/api/propostas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: cliente.id, cliente: cliente.empresa,
          itens: itensValidos, condicoes, validade_dias: Number(validade) || 15,
        }),
      });
      const d = await r.json();
      if (!r.ok) setMsg({ tipo: "erro", texto: d.erro || "Falha ao gerar." });
      else setMsg({ tipo: "ok", texto: "Proposta gerada e salva nos documentos do cliente!", docId: d.documento_id });
    } catch {
      setMsg({ tipo: "erro", texto: "Erro de conexão." });
    } finally {
      setGerando(false);
    }
  }

  const campo: React.CSSProperties = { padding: "9px 11px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14, boxSizing: "border-box" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #E3E8F0", borderRadius: 12, padding: 20, maxWidth: 820 };
  const rotulo: React.CSSProperties = { fontSize: 12, color: "#607D8B", marginBottom: 4, display: "block" };

  return (
    <div style={card}>
      <label style={rotulo}>Cliente *</label>
      <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={{ ...campo, width: "100%", marginBottom: 16 }}>
        <option value="">Selecione um cliente…</option>
        {clientes.map((c) => <option key={c.id} value={c.id}>{c.empresa}{c.cnpj ? ` — ${c.cnpj}` : ""}</option>)}
      </select>

      <label style={rotulo}>Itens da proposta</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#90A4AE" }}>
          <span style={{ flex: 3 }}>Descrição</span>
          <span style={{ width: 60 }}>Qtd</span>
          <span style={{ width: 110 }}>Valor unit. (R$)</span>
          <span style={{ width: 28 }} />
        </div>
        {itens.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input value={it.descricao} onChange={(e) => setItem(i, "descricao", e.target.value)}
              placeholder="Ex.: Armazenagem (posições-pallet/mês)" style={{ ...campo, flex: 3 }} />
            <input value={it.quantidade} onChange={(e) => setItem(i, "quantidade", e.target.value)}
              style={{ ...campo, width: 60 }} />
            <input value={it.valor_unitario} onChange={(e) => setItem(i, "valor_unitario", e.target.value)}
              placeholder="a definir" style={{ ...campo, width: 110 }} />
            <button onClick={() => delItem(i)} disabled={itens.length === 1}
              style={{ width: 28, background: "none", border: "1px solid #F0D0CC", color: "#C0392B",
                borderRadius: 8, cursor: itens.length === 1 ? "not-allowed" : "pointer", opacity: itens.length === 1 ? 0.4 : 1 }}>×</button>
          </div>
        ))}
      </div>
      <button onClick={addItem} style={{ marginTop: 8, background: "#EEF2F8", border: "1px solid #D6DEEA",
        color: "#1F3864", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>+ item</button>

      <div style={{ textAlign: "right", marginTop: 10, fontSize: 15, color: "#1F3864", fontWeight: 700 }}>
        Total: R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={rotulo}>Condições (opcional)</label>
          <textarea value={condicoes} onChange={(e) => setCondicoes(e.target.value)} rows={2}
            placeholder="Deixe em branco para o texto padrão de validade." style={{ ...campo, width: "100%", resize: "vertical" }} />
        </div>
        <div style={{ width: 120 }}>
          <label style={rotulo}>Validade (dias)</label>
          <input value={validade} onChange={(e) => setValidade(e.target.value)} style={{ ...campo, width: "100%" }} />
        </div>
      </div>

      {msg && (
        <p style={{ fontSize: 14, marginTop: 14, color: msg.tipo === "ok" ? "#2E7D32" : "#C0392B" }}>
          {msg.texto}{" "}
          {msg.docId && (
            <a href={`/api/documentos/download?id=${msg.docId}`} target="_blank" rel="noreferrer"
              style={{ color: "#2E75B6" }}>Abrir PDF</a>
          )}
        </p>
      )}

      <button onClick={gerar} disabled={gerando || !clienteId}
        style={{ marginTop: 16, padding: "12px 22px", background: "#1F3864", color: "#fff", border: "none",
          borderRadius: 8, fontSize: 14, cursor: "pointer", opacity: gerando || !clienteId ? 0.6 : 1 }}>
        {gerando ? "Gerando PDF…" : "Gerar proposta (PDF)"}
      </button>
    </div>
  );
}
