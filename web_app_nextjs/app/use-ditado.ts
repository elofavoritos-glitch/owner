"use client";
// Hook de ditado por voz (Web Speech API). Transcreve fala PT-BR em texto.
// Funciona de forma CONTÍNUA: o usuário toca uma vez, fala com pausas à vontade,
// e toca de novo para parar. Lida com os reinícios internos que o navegador faz.
//
// Suporte: ótimo no Chrome/Edge (desktop e Android). Safari/iOS é limitado.
import { useCallback, useEffect, useRef, useState } from "react";

type ResultLike = { 0: { transcript: string }; isFinal: boolean };
type EventLike = { results: ArrayLike<ResultLike>; resultIndex: number };
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: EventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function getCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useDitado(onTexto: (texto: string) => void) {
  const [suportado, setSuportado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recRef = useRef<RecognitionLike | null>(null);
  const cbRef = useRef(onTexto);
  cbRef.current = onTexto;

  // Flags de controle (ref para não cair em closure velha).
  const querOuvirRef = useRef(false); // usuário mandou ouvir e ainda não parou
  const finalRef = useRef("");        // transcrição final acumulada entre sessões
  const reiniciarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSuportado(Boolean(getCtor()));
    return () => {
      querOuvirRef.current = false;
      if (reiniciarTimer.current) clearTimeout(reiniciarTimer.current);
      try { recRef.current?.abort(); } catch { /* ignore */ }
    };
  }, []);

  // Cria uma nova instância configurada. Cada sessão usa uma instância nova —
  // reiniciar o MESMO objeto costuma falhar nos navegadores.
  const criar = useCallback((): RecognitionLike | null => {
    const Ctor = getCtor();
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setOuvindo(true);

    rec.onresult = (e) => {
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalRef.current += (finalRef.current && !finalRef.current.endsWith(" ") ? " " : "") + t.trim() + " ";
        else interino += t;
      }
      const texto = (finalRef.current + interino).replace(/\s+/g, " ").trim();
      cbRef.current(texto);
    };

    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setErro("Permissão de microfone negada. Autorize o microfone nas configurações do navegador.");
        querOuvirRef.current = false;
        setOuvindo(false);
      } else if (ev.error === "no-speech" || ev.error === "aborted" || ev.error === "network") {
        // não fatais: no-speech/aborted são normais; o onend decide reiniciar.
      } else {
        setErro("Erro no reconhecimento de voz: " + ev.error);
      }
    };

    // O navegador encerra a sessão periodicamente (ou após silêncio). Se o
    // usuário ainda quer ouvir, criamos uma NOVA instância após um pequeno
    // atraso (reiniciar imediatamente, ou o mesmo objeto, costuma falhar).
    rec.onend = () => {
      if (!querOuvirRef.current) {
        setOuvindo(false);
        return;
      }
      reiniciarTimer.current = setTimeout(() => {
        if (!querOuvirRef.current) return;
        const nova = criar();
        if (!nova) { querOuvirRef.current = false; setOuvindo(false); return; }
        recRef.current = nova;
        try {
          nova.start();
        } catch {
          querOuvirRef.current = false;
          setOuvindo(false);
        }
      }, 250);
    };

    return rec;
  }, []);

  const parar = useCallback(() => {
    querOuvirRef.current = false;
    if (reiniciarTimer.current) clearTimeout(reiniciarTimer.current);
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setOuvindo(false);
  }, []);

  const iniciar = useCallback(() => {
    if (querOuvirRef.current) return; // já ouvindo
    const rec = criar();
    if (!rec) {
      setErro("Seu navegador não suporta ditado por voz. Use o Chrome ou Edge (desktop ou Android).");
      return;
    }
    setErro(null);
    finalRef.current = "";
    querOuvirRef.current = true;
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      // Se já havia uma sessão presa, aborta e tenta de novo.
      try { rec.abort(); } catch { /* ignore */ }
      querOuvirRef.current = false;
      setOuvindo(false);
      setErro("Não foi possível iniciar o microfone. Tente novamente.");
    }
  }, [criar]);

  const alternar = useCallback(() => {
    if (querOuvirRef.current) parar();
    else iniciar();
  }, [parar, iniciar]);

  return { suportado, ouvindo, erro, alternar, parar };
}
