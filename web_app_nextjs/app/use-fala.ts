"use client";
// Fala (text-to-speech) do assistente.
// 1) Tenta o Google Cloud TTS (/api/falar) — voz natural PT-BR, toca um MP3
//    (funciona em qualquer navegador, inclusive Safari/iOS).
// 2) Se o TTS do servidor não estiver configurado/falhar, cai para a Web Speech
//    Synthesis do navegador (grátis, porém robótica).
// O usuário liga/desliga via botão; a preferência fica salva.
import { useCallback, useEffect, useRef, useState } from "react";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
}

export function useFala() {
  const [suportado, setSuportado] = useState(false);
  const [ligado, setLigado] = useState(false);
  const [falando, setFalando] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const servidorIndisponivelRef = useRef(false); // se /api/falar não tem chave, nem tenta de novo
  const vozNavRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    // Suportado se há <audio> (sempre) ou speechSynthesis.
    const ok = typeof window !== "undefined";
    setSuportado(ok);
    if (ok) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setFalando(false);
      audioRef.current.onerror = () => setFalando(false);
      // pré-carrega vozes do navegador (fallback)
      if ("speechSynthesis" in window) {
        const carregar = () => {
          const vs = window.speechSynthesis.getVoices();
          vozNavRef.current = vs.find((v) => v.lang?.toLowerCase().startsWith("pt")) || null;
        };
        carregar();
        window.speechSynthesis.onvoiceschanged = carregar;
      }
    }
    try { setLigado(localStorage.getItem("elo-voz") === "1"); } catch { /* ignore */ }
    return () => {
      try { audioRef.current?.pause(); } catch { /* ignore */ }
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    };
  }, []);

  const pararNavegador = () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } };

  const parar = useCallback(() => {
    try { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; } catch { /* ignore */ }
    pararNavegador();
    setFalando(false);
  }, []);

  // Fallback: TTS do navegador.
  const falarNavegador = useCallback((texto: string) => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const executar = () => {
      try {
        if (synth.speaking || synth.pending) synth.cancel();
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = "pt-BR"; u.rate = 1.03;
        if (vozNavRef.current) u.voice = vozNavRef.current;
        u.onstart = () => setFalando(true);
        u.onend = () => setFalando(false);
        u.onerror = () => setFalando(false);
        synth.speak(u);
      } catch { /* ignore */ }
    };
    if (isIOS()) setTimeout(executar, 120); else executar();
  }, []);

  // Toca o MP3 do Google TTS; retorna true se conseguiu.
  const falarServidor = useCallback(async (texto: string): Promise<boolean> => {
    if (servidorIndisponivelRef.current) return false;
    try {
      const r = await fetch("/api/falar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      if (r.status === 503) { servidorIndisponivelRef.current = true; return false; } // sem chave
      if (!r.ok) return false;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current!;
      audio.src = url;
      audio.onended = () => { setFalando(false); URL.revokeObjectURL(url); };
      setFalando(true);
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }, []);

  const falar = useCallback((texto: string) => {
    if (!ligado || !texto) return;
    const limpo = texto.replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim();
    if (!limpo) return;
    parar();
    // tenta o servidor (voz natural); se não rolar, usa o navegador.
    falarServidor(limpo).then((ok) => { if (!ok) falarNavegador(limpo); });
  }, [ligado, parar, falarServidor, falarNavegador]);

  // Ao ligar, "destrava" o áudio no iOS tocando algo dentro do gesto.
  const alternarLigado = useCallback(() => {
    setLigado((v) => {
      const novo = !v;
      try { localStorage.setItem("elo-voz", novo ? "1" : "0"); } catch { /* ignore */ }
      if (novo) {
        // prime: no gesto do usuário, destrava tanto o <audio> quanto o synth do iOS
        try {
          const a = audioRef.current;
          if (a) { a.muted = true; a.play().then(() => { a.pause(); a.muted = false; }).catch(() => { a.muted = false; }); }
        } catch { /* ignore */ }
        if (isIOS() && "speechSynthesis" in window) {
          try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* ignore */ }
        }
      } else {
        parar();
      }
      return novo;
    });
  }, [parar]);

  return { suportado, ligado, falando, alternarLigado, falar, parar };
}
