"use client";
import { useEffect, useState } from "react";
import Documentos from "./documentos";
import ImportarPlanilha from "./importar";

type Cliente = {
  id: string;
  empresa: string;
  cnpj: string | null;
  contato: string | null;
  email: string | null;
  telefone: string | null;
  segmento: string | null;
  cidade: string | null;
  uf: string | null;
  regiao: string | null;
  responsavel_nome: string | null;
  observacoes: string | null;
};

export default function ClientesForm() {
  const [lista, setLista] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Cliente | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const vazio = {
    empresa: "", cnpj: "", contato: "", email: "", telefone: "",
    segmento: "", cidade: "", uf: "", regiao: "", observacoes: "",
  };
  const [f, setF] = useState(vazio);
  const set = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function carregar(q = "") {
    setCarregando(true);
    try {
      const r = await fetch("/api/clientes" + (q ? `?busca=${encodeURIComponent(q)}` : ""));
      const d = await r.json();
      setLista(d.clientes ?? []);
    } catch {
      /* silencioso */
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.empresa.trim() || salvando) return;
    setSalvando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: d.erro || "Falha ao salvar." });
      } else {
        setMsg({ tipo: "ok", texto: "Cliente cadastrado!" });
        setF(vazio);
        carregar(busca);
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
  const linha: React.CSSProperties = { display: "flex", gap: 10, marginTop: 12 };

  return (
    <div>
    <div style={{ marginBottom: 4 }}>
      <ImportarPlanilha aoImportar={() => carregar(busca)} />
    </div>
    <div className="elo-split" style={{ marginTop: 16 }}>
      {/* Formulário */}
      <form onSubmit={salvar} style={card}>
        <h2 style={{ color: "#1F3864", fontSize: 16, marginTop: 0 }}>Novo cliente</h2>

        <label style={rotulo}>Empresa *</label>
        <input value={f.empresa} onChange={set("empresa")} placeholder="Razão social ou nome fantasia" style={campo} required />

        <div style={linha}>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>CNPJ</label>
            <input value={f.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0000-00" style={campo} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>Segmento</label>
            <input value={f.segmento} onChange={set("segmento")} placeholder="Indústria, varejo…" style={campo} />
          </div>
        </div>

        <div style={linha}>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>Contato</label>
            <input value={f.contato} onChange={set("contato")} placeholder="Nome do contato" style={campo} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>Telefone</label>
            <input value={f.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" style={campo} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={rotulo}>E-mail</label>
          <input value={f.email} onChange={set("email")} placeholder="contato@empresa.com" style={campo} />
        </div>

        <div style={linha}>
          <div style={{ flex: 2 }}>
            <label style={rotulo}>Cidade</label>
            <input value={f.cidade} onChange={set("cidade")} placeholder="Itajaí" style={campo} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>UF</label>
            <input value={f.uf} onChange={set("uf")} placeholder="SC" maxLength={2} style={campo} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={rotulo}>Região</label>
          <input value={f.regiao} onChange={set("regiao")} placeholder="Vale do Itajaí, Sul…" style={campo} />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={rotulo}>Observações</label>
          <textarea value={f.observacoes} onChange={set("observacoes")} rows={2} style={{ ...campo, resize: "vertical" }} />
        </div>

        {msg && (
          <p style={{ fontSize: 13, marginTop: 12, color: msg.tipo === "ok" ? "#2E7D32" : "#C0392B" }}>{msg.texto}</p>
        )}

        <button type="submit" disabled={salvando || !f.empresa.trim()}
          style={{ width: "100%", marginTop: 14, padding: "12px", background: "#1F3864", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer", opacity: salvando || !f.empresa.trim() ? 0.6 : 1 }}>
          {salvando ? "Salvando…" : "Cadastrar cliente"}
        </button>
      </form>

      {/* Lista */}
      <div style={card}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") carregar(busca); }}
            placeholder="Buscar por empresa ou CNPJ…"
            style={{ ...campo, flex: 1 }}
          />
          <button onClick={() => carregar(busca)} style={{ padding: "10px 16px", background: "#2E75B6",
            color: "#fff", border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
            Buscar
          </button>
        </div>

        {carregando ? (
          <p style={{ color: "#90A4AE", fontSize: 14 }}>Carregando…</p>
        ) : lista.length === 0 ? (
          <p style={{ color: "#90A4AE", fontSize: 14 }}>Nenhum cliente encontrado.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "62vh", overflowY: "auto" }}>
            {lista.map((c) => {
              const aberto = selecionado?.id === c.id;
              return (
                <div key={c.id} style={{ border: "1px solid " + (aberto ? "#2E75B6" : "#EEF2F8"), borderRadius: 10, padding: "10px 14px" }}>
                  <div
                    onClick={() => setSelecionado(aberto ? null : c)}
                    style={{ cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ color: "#1F3864", fontSize: 14 }}>{c.empresa}</strong>
                      <span style={{ fontSize: 12, color: "#90A4AE" }}>
                        {c.uf ? `${c.cidade ? c.cidade + "/" : ""}${c.uf}` : ""} {aberto ? "▲" : "▾"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#607D8B", marginTop: 2 }}>
                      {[c.cnpj, c.segmento, c.contato].filter(Boolean).join(" · ") || "sem detalhes"}
                    </div>
                    {(c.email || c.telefone) && (
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                        {[c.email, c.telefone].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  {aberto && <Documentos clienteId={c.id} empresa={c.empresa} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
