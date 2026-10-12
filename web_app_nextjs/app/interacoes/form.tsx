"use client";
import { useEffect, useRef, useState } from "react";
import { useDitado } from "../use-ditado";
import { IconMic, IconStop } from "../icons";

type Interacao = {
  id: string;
  empresa: string;
  canal: string;
  direcao: string;
  assunto: string | null;
  data_interacao: string;
  observacao: string | null;
  responsavel_nome: string | null;
};

const CANAIS = [
  { v: "email", l: "E-mail" },
  { v: "ligacao", l: "Ligação" },
  { v: "reuniao", l: "Reunião" },
  { v: "whatsapp", l: "WhatsApp" },
  { v: "evento", l: "Evento" },
  { v: "outro", l: "Outro" },
];

const CANAL_LABEL: Record<string, string> = Object.fromEntries(CANAIS.map((c) => [c.v, c.l]));
const hoje = () => new Date().toISOString().slice(0, 10);

export default function InteracoesForm() {
  const [lista, setLista] = useState<Interacao[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const [empresa, setEmpresa] = useState("");
  const [canal, setCanal] = useState("email");
  const [direcao, setDirecao] = useState("enviado");
  const [assunto, setAssunto] = useState("");
  const [data, setData] = useState(hoje());
  const [observacao, setObservacao] = useState("");

  // Ditado por voz para a observação: anexa a transcrição ao texto já existente.
  const baseObsRef = useRef("");
  const { suportado: vozSuportada, ouvindo, transcrevendo, erro: erroVoz, alternar: alternarVoz } = useDitado((t) => {
    const base = baseObsRef.current;
    setObservacao(base ? `${base} ${t}` : t);
  });
  function ditarObservacao() {
    if (!ouvindo) baseObsRef.current = observacao.trim();
    alternarVoz();
  }

  async function carregar() {
    setCarregandoLista(true);
    try {
      const r = await fetch("/api/interacoes");
      const d = await r.json();
      setLista(d.interacoes ?? []);
    } catch {
      /* silencioso */
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!empresa.trim() || salvando) return;
    setSalvando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/interacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa, canal, direcao, assunto, data_interacao: data, observacao }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: d.erro || "Falha ao registrar." });
      } else {
        setMsg({ tipo: "ok", texto: "Interação registrada!" });
        setEmpresa(""); setAssunto(""); setObservacao(""); setData(hoje());
        setCanal("email"); setDirecao("enviado");
        carregar();
      }
    } catch {
      setMsg({ tipo: "erro", texto: "Erro de conexão." });
    } finally {
      setSalvando(false);
    }
  }

  const campo: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1px solid #CBD5E1",
    borderRadius: 8, fontSize: 14, boxSizing: "border-box",
  };
  const rotulo: React.CSSProperties = { fontSize: 12, color: "#607D8B", marginBottom: 4, display: "block" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #E3E8F0", borderRadius: 12, padding: 20 };

  return (
    <div className="elo-split">
      {/* Formulário */}
      <form onSubmit={salvar} style={card}>
        <h2 style={{ color: "#1F3864", fontSize: 16, marginTop: 0 }}>Registrar interação</h2>

        <label style={rotulo}>Empresa *</label>
        <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome do cliente" style={campo} required />

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>Canal</label>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} style={campo}>
              {CANAIS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>Direção</label>
            <select value={direcao} onChange={(e) => setDirecao(e.target.value)} style={campo}>
              <option value="enviado">Nós contatamos</option>
              <option value="recebido">Cliente respondeu/procurou</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={rotulo}>Data</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={campo} />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={rotulo}>Assunto</label>
          <input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: Proposta de armazenagem" style={campo} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={rotulo}>Observação</label>
            {vozSuportada && (
              <button
                type="button"
                onClick={ditarObservacao}
                disabled={transcrevendo}
                title={ouvindo ? "Parar e transcrever" : "Ditar observação"}
                style={{ display: "inline-flex", alignItems: "center", gap: 6,
                  background: ouvindo ? "var(--grad-verde)" : "rgba(255,255,255,.8)", color: ouvindo ? "#fff" : "var(--elo-azul)",
                  border: "1px solid " + (ouvindo ? "transparent" : "var(--glass-borda)"), borderRadius: "var(--r-full)",
                  padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: transcrevendo ? "wait" : "pointer", marginBottom: 4,
                  opacity: transcrevendo ? 0.6 : 1 }}
              >
                {transcrevendo ? "transcrevendo…" : ouvindo ? <><IconStop size={13} /> gravando…</> : <><IconMic size={14} /> ditar</>}
              </button>
            )}
          </div>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} placeholder={ouvindo ? "Pode falar…" : "Detalhes do contato…"} style={{ ...campo, resize: "vertical", borderColor: ouvindo ? "#C0392B" : "#CBD5E1" }} />
          {erroVoz && <p style={{ color: "#C0392B", fontSize: 12, margin: "4px 0 0" }}>{erroVoz}</p>}
        </div>

        {msg && (
          <p style={{ fontSize: 13, marginTop: 12, color: msg.tipo === "ok" ? "#2E7D32" : "#C0392B" }}>{msg.texto}</p>
        )}

        <button type="submit" disabled={salvando || !empresa.trim()}
          style={{ width: "100%", marginTop: 14, padding: "12px", background: "#1F3864", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer", opacity: salvando || !empresa.trim() ? 0.6 : 1 }}>
          {salvando ? "Salvando…" : "Registrar interação"}
        </button>
      </form>

      {/* Lista */}
      <div style={card}>
        <h2 style={{ color: "#1F3864", fontSize: 16, marginTop: 0 }}>Interações recentes</h2>
        {carregandoLista ? (
          <p style={{ color: "#90A4AE", fontSize: 14 }}>Carregando…</p>
        ) : lista.length === 0 ? (
          <p style={{ color: "#90A4AE", fontSize: 14 }}>Nenhuma interação registrada ainda.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "60vh", overflowY: "auto" }}>
            {lista.map((it) => (
              <div key={it.id} style={{ border: "1px solid #EEF2F8", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ color: "#1F3864", fontSize: 14 }}>{it.empresa}</strong>
                  <span style={{ fontSize: 12, color: "#90A4AE" }}>
                    {it.data_interacao.split("-").reverse().join("/")}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#607D8B", marginTop: 2 }}>
                  {CANAL_LABEL[it.canal] ?? it.canal} ·{" "}
                  {it.direcao === "recebido" ? "cliente respondeu/procurou" : "nós contatamos"}
                  {it.responsavel_nome ? ` · ${it.responsavel_nome}` : ""}
                </div>
                {it.assunto && <div style={{ fontSize: 13, marginTop: 4 }}>{it.assunto}</div>}
                {it.observacao && <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{it.observacao}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
