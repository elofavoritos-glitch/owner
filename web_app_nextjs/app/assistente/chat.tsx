"use client";
import { useRef, useState, useEffect } from "react";
import { useDitado } from "../use-ditado";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Quais oportunidades estão em negociação?",
  "Monte o dossiê da Transportadora Horizonte",
  "Qual o pipeline potencial total?",
  "Como avalio o potencial de um novo cliente?",
];

export default function Chat({ email }: { email: string }) {
  const [mensagens, setMensagens] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o assistente comercial da ELO. Posso consultar o funil de oportunidades, " +
        "montar dossiês de clientes, calcular score e recomendar a próxima ação. Como posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const { suportado, ouvindo, erro: erroVoz, alternar } = useDitado(setInput);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, carregando]);

  async function enviar(texto: string) {
    const msg = texto.trim();
    if (!msg || carregando) return;
    const novas: Msg[] = [...mensagens, { role: "user", content: msg }];
    setMensagens(novas);
    setInput("");
    setCarregando(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: novas.filter((m) => m.role !== "assistant" || m !== novas[0]) }),
      });
      const d = await r.json();
      let resposta = d.content || d.erro || "Não consegui responder.";
      if (d.erro && (d.status || d.detalhe)) {
        resposta += `\n\n(diagnóstico — status ${d.status ?? "?"}: ${d.detalhe ?? ""})`;
      }
      setMensagens((m) => [...m, { role: "assistant", content: resposta }]);
    } catch {
      setMensagens((m) => [...m, { role: "assistant", content: "Erro de conexão. Tente novamente." }]);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 160px)", minHeight: 360, maxWidth: 820, margin: "0 auto" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 4px", display: "flex", flexDirection: "column", gap: 12 }}>
        {mensagens.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              background: m.role === "user" ? "#1F3864" : "#fff",
              color: m.role === "user" ? "#fff" : "#1F2937",
              border: m.role === "user" ? "none" : "1px solid #E3E8F0",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
          </div>
        ))}
        {carregando && (
          <div style={{ alignSelf: "flex-start", color: "#90A4AE", fontSize: 13, padding: "6px 10px" }}>
            o assistente está pensando…
          </div>
        )}
        <div ref={fim} />
      </div>

      {mensagens.length <= 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 4px" }}>
          {SUGESTOES.map((s) => (
            <button
              key={s}
              onClick={() => enviar(s)}
              style={{ background: "#EEF2F8", border: "1px solid #D6DEEA", color: "#1F3864",
                borderRadius: 20, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); enviar(input); }}
        style={{ display: "flex", gap: 8, padding: "10px 4px", borderTop: "1px solid #E3E8F0" }}
      >
        {suportado && (
          <button
            type="button"
            onClick={alternar}
            title={ouvindo ? "Parar de ouvir" : "Falar"}
            aria-label={ouvindo ? "Parar de ouvir" : "Falar"}
            style={{ width: 46, flexShrink: 0, background: ouvindo ? "#C0392B" : "#EEF2F8",
              color: ouvindo ? "#fff" : "#1F3864", border: "1px solid " + (ouvindo ? "#C0392B" : "#D6DEEA"),
              borderRadius: 10, fontSize: 18, cursor: "pointer" }}
          >
            {ouvindo ? "■" : "🎤"}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ouvindo ? "Ouvindo… pode falar" : "Pergunte, ou toque no 🎤 para falar…"}
          style={{ flex: 1, padding: "12px 14px", border: "1px solid " + (ouvindo ? "#C0392B" : "#CBD5E1"),
            borderRadius: 10, fontSize: 14 }}
        />
        <button
          type="submit"
          disabled={carregando || !input.trim()}
          style={{ padding: "12px 20px", background: "#2E75B6", color: "#fff", border: "none",
            borderRadius: 10, fontSize: 14, cursor: "pointer", opacity: carregando || !input.trim() ? 0.6 : 1 }}
        >
          Enviar
        </button>
      </form>
      {erroVoz && (
        <p style={{ color: "#C0392B", fontSize: 12, textAlign: "center", margin: "4px 0 0" }}>{erroVoz}</p>
      )}
      <p style={{ color: "#90A4AE", fontSize: 11, textAlign: "center", margin: "4px 0 0" }}>
        Logado como {email}. O assistente usa dados do funil da ELO e nunca inventa informações.
        {suportado ? " 🎤 Ditado por voz disponível." : ""}
      </p>
    </div>
  );
}
