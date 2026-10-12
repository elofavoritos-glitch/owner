"use client";
import { useRef, useState, useEffect } from "react";
import { useDitado } from "../use-ditado";
import { useFala } from "../use-fala";
import { IconMic, IconStop, IconEnviar, IconSom, IconSomOff } from "../icons";

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
  const [ouvindoIdx, setOuvindoIdx] = useState<number | null>(null); // qual mensagem está tocando/gerando
  const fim = useRef<HTMLDivElement>(null);
  const { suportado, ouvindo, transcrevendo, erro: erroVoz, alternar } = useDitado(
    (t) => setInput((prev) => (prev ? `${prev} ${t}` : t)),
  );
  const { suportado: falaSuportada, ligado: vozLigada, falando, preparando, alternarLigado, falar, ouvir, parar: pararFala } = useFala();

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
      if (d.content) falar(d.content); // lê em voz alta se a voz estiver ligada
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
              background: m.role === "user" ? "var(--grad-azul-suave)" : "var(--glass-forte)",
              color: m.role === "user" ? "#fff" : "#1F2937",
              border: m.role === "user" ? "none" : "1px solid var(--glass-borda)",
              borderRadius: 16,
              padding: "11px 15px",
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              boxShadow: "var(--sombra-sm)",
            }}
          >
            {m.content}
            {m.role === "assistant" && i > 0 && falaSuportada && (() => {
              const ativo = ouvindoIdx === i;
              const gerando = ativo && preparando;
              const tocando = ativo && falando;
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (gerando || tocando) { pararFala(); setOuvindoIdx(null); }
                    else { setOuvindoIdx(i); ouvir(m.content); }
                  }}
                  title={tocando ? "Parar" : "Ouvir"}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8,
                    background: ativo ? "var(--grad-azul-suave)" : "rgba(46,117,182,.1)",
                    color: ativo ? "#fff" : "var(--elo-azul)", border: "none",
                    borderRadius: "var(--r-full)", padding: "4px 11px", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", transition: "background .15s" }}
                >
                  {gerando ? <>⏳ Gerando…</> : tocando ? <><IconStop size={12} /> Parar</> : <><IconSom size={13} /> Ouvir</>}
                </button>
              );
            })()}
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

      {falaSuportada && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 4px 0" }}>
          <button
            type="button"
            onClick={() => { if (vozLigada && falando) pararFala(); alternarLigado(); }}
            title={vozLigada ? "Desligar voz do assistente" : "Ligar voz do assistente"}
            style={{ display: "inline-flex", alignItems: "center", gap: 6,
              background: vozLigada ? "var(--grad-azul-suave)" : "rgba(255,255,255,.7)",
              color: vozLigada ? "#fff" : "var(--txt-2)",
              border: "1px solid " + (vozLigada ? "transparent" : "var(--glass-borda)"), borderRadius: "var(--r-full)",
              padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {vozLigada ? <IconSom /> : <IconSomOff />} {vozLigada ? "Voz ligada" : "Voz desligada"}
          </button>
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
            disabled={transcrevendo}
            title={ouvindo ? "Parar e transcrever" : "Gravar e falar"}
            aria-label={ouvindo ? "Parar e transcrever" : "Gravar e falar"}
            style={{ width: 48, flexShrink: 0, display: "grid", placeItems: "center",
              background: ouvindo ? "var(--grad-verde)" : "rgba(255,255,255,.8)",
              color: ouvindo ? "#fff" : "var(--elo-azul)", border: "1px solid " + (ouvindo ? "transparent" : "var(--glass-borda)"),
              borderRadius: 12, cursor: transcrevendo ? "wait" : "pointer", opacity: transcrevendo ? 0.6 : 1,
              boxShadow: ouvindo ? "0 6px 18px rgba(34,197,94,.4)" : "var(--sombra-sm)" }}
          >
            {transcrevendo ? "…" : ouvindo ? <IconStop /> : <IconMic />}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ouvindo ? "Gravando… toque no botão para transcrever" : transcrevendo ? "Transcrevendo…" : "Pergunte, ou toque no microfone para falar…"}
          className="elo-input"
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          disabled={carregando || !input.trim()}
          className="elo-btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
        >
          <IconEnviar /> Enviar
        </button>
      </form>
      {erroVoz && (
        <p style={{ color: "#C0392B", fontSize: 12, textAlign: "center", margin: "4px 0 0" }}>{erroVoz}</p>
      )}
      <p style={{ color: "#90A4AE", fontSize: 11, textAlign: "center", margin: "4px 0 0" }}>
        Logado como {email}. O assistente usa dados do funil da ELO e nunca inventa informações.
        {suportado ? " Ditado por voz disponível." : ""}
      </p>
    </div>
  );
}
