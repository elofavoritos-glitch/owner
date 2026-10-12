"use client";
// Hook de ditado por voz usando a Web Speech API do navegador (grátis, sem
// servidor). Transcreve fala em PT-BR para texto. Suporte varia por navegador
// (ótimo no Chrome/Edge/Android; limitado no Safari/iOS).
import { useCallback, useEffect, useRef, useState } from "react";

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

  // Controle via ref (não só state) para não cair em closure velha.
  const ativoRef = useRef(false);          // o usuário quer continuar ouvindo?
  const finalRef = useRef("");             // texto já finalizado acumulado

  useEffect(() => {
    setSuportado(Boolean(getRecognitionCtor()));
    return () => {
      ativoRef.current = false;
      recRef.current?.abort();
    };
  }, []);

  const parar = useCallback(() => {
    ativoRef.current = false;
    recRef.current?.stop();
    setOuvindo(false);
  }, []);

  const iniciar = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setErro("Seu navegador não suporta ditado por voz. Use o Chrome ou Edge (no computador ou Android).");
      return;
    }
    setErro(null);
    finalRef.current = "";
    ativoRef.current = true;

    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;      // não encerra na primeira pausa
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + " ";
        else interino += r[0].transcript;
      }
      callbackRef.current((finalRef.current + interino).trim());
    };

    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setErro("Permissão de microfone negada. Autorize o microfone no navegador.");
        ativoRef.current = false;
        setOuvindo(false);
      } else if (ev.error === "no-speech") {
        // silêncio: o onend vai reiniciar automaticamente, não é erro fatal.
      } else if (ev.error === "aborted") {
        // parada intencional, ignora.
      } else {
        setErro("Erro no reconhecimento de voz. Tente novamente.");
      }
    };

    // Quando o motor encerra sozinho (pausa longa), reinicia se o usuário ainda
    // quer ouvir — é isso que faz o ditado continuar em vez de parar na 1ª vez.
    rec.onend = () => {
      if (ativoRef.current) {
        try {
          rec.start();
        } catch {
          ativoRef.current = false;
          setOuvindo(false);
        }
      } else {
        setOuvindo(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setOuvindo(true);
    } catch {
      // start() pode lançar se já estiver rodando; garante estado coerente.
      setOuvindo(true);
    }
  }, []);

  const alternar = useCallback(() => {
    if (ativoRef.current) parar();
    else iniciar();
  }, [parar, iniciar]);

  return { suportado, ouvindo, erro, alternar, parar };
}
