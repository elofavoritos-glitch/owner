"use client";
// Hook de ditado por voz usando a Web Speech API do navegador (grátis, sem
// servidor). Transcreve fala em PT-BR para texto. Suporte varia por navegador
// (ótimo no Chrome/Edge/Android; limitado no Safari/iOS).
import { useCallback, useEffect, useRef, useState } from "react";

// Tipos mínimos da Web Speech API (não há tipos oficiais no DOM lib).
type SpeechRecognitionResultLike = { 0: { transcript: string }; isFinal: boolean };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike>; resultIndex: number };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useDitado(onTexto: (texto: string) => void) {
  const [suportado, setSuportado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const callbackRef = useRef(onTexto);
  callbackRef.current = onTexto;

  useEffect(() => {
    setSuportado(Boolean(getRecognitionCtor()));
    // Cleanup: se o componente desmontar durante a captura, aborta o microfone.
    return () => {
      recRef.current?.abort();
    };
  }, []);

  const parar = useCallback(() => {
    recRef.current?.stop();
    setOuvindo(false);
  }, []);

  const alternar = useCallback(() => {
    setErro(null);
    if (ouvindo) {
      parar();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setErro("Seu navegador não suporta ditado por voz. Use o Chrome ou Edge.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;

    let finalAcumulado = "";
    rec.onresult = (e) => {
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalAcumulado += r[0].transcript;
        else interino += r[0].transcript;
      }
      callbackRef.current((finalAcumulado + interino).trim());
    };
    rec.onerror = (ev) => {
      if (ev.error === "no-speech") setErro("Não ouvi nada. Tente de novo.");
      else if (ev.error === "not-allowed") setErro("Permissão de microfone negada.");
      else setErro("Erro no reconhecimento de voz.");
      setOuvindo(false);
    };
    rec.onend = () => setOuvindo(false);

    recRef.current = rec;
    try {
      rec.start();
      setOuvindo(true);
    } catch {
      setErro("Não foi possível iniciar o microfone.");
    }
  }, [ouvindo, parar]);

  return { suportado, ouvindo, erro, alternar, parar };
}
