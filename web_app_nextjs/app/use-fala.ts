"use client";
// Fala (text-to-speech) via Web Speech Synthesis do navegador.
// Tratamento especial para iOS/Safari, que exige um "prime" (fala real dentro
// de um gesto do usuário) para liberar o canal de áudio, e tem bugs com
// cancel()/getVoices(). O usuário liga/desliga via botão.
import { useCallback, useEffect, useRef, useState } from "react";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1); // iPad iOS13+
}

export function useFala() {
  const [suportado, setSuportado] = useState(false);
  const [ligado, setLigado] = useState(false);
  const [falando, setFalando] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const vozRef = useRef<SpeechSynthesisVoice | null>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSuportado(ok);
    if (!ok) return;
    const synth = window.speechSynthesis;
    synthRef.current = synth;

    // Carrega as vozes (no iOS/Chrome vêm de forma assíncrona).
    const carregarVozes = () => {
      const vozes = synth.getVoices();
      if (vozes.length) {
        vozRef.current =
          vozes.find((v) => v.lang?.toLowerCase() === "pt-br") ||
          vozes.find((v) => v.lang?.toLowerCase().startsWith("pt")) ||
          null;
      }
    };
    carregarVozes();
    synth.onvoiceschanged = carregarVozes;

    try { setLigado(localStorage.getItem("elo-voz") === "1"); } catch { /* ignore */ }

    return () => {
      try { synth.cancel(); } catch { /* ignore */ }
      synth.onvoiceschanged = null;
    };
  }, []);

  // Monta um utterance já com a voz/idioma corretos.
  const criarUtterance = useCallback((texto: string) => {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    u.rate = 1.03;
    u.pitch = 1;
    if (vozRef.current) u.voice = vozRef.current;
    return u;
  }, []);

  // Chamado DENTRO do gesto de toque (ao ligar a voz): fala uma confirmação
  // curta. No iOS, isto é o que libera o áudio para as próximas falas.
  const primeAudio = useCallback(() => {
    const synth = synthRef.current;
    if (!synth) return;
    try {
      const u = criarUtterance("Voz ativada");
      u.onend = () => { primedRef.current = true; };
      synth.speak(u);
      primedRef.current = true;
    } catch { /* ignore */ }
  }, [criarUtterance]);

  const alternarLigado = useCallback(() => {
    setLigado((v) => {
      const novo = !v;
      try { localStorage.setItem("elo-voz", novo ? "1" : "0"); } catch { /* ignore */ }
      if (novo) {
        primeAudio();
      } else {
        try { synthRef.current?.cancel(); } catch { /* ignore */ }
        setFalando(false);
      }
      return novo;
    });
  }, [primeAudio]);

  const parar = useCallback(() => {
    try { synthRef.current?.cancel(); } catch { /* ignore */ }
    setFalando(false);
  }, []);

  const falar = useCallback((texto: string) => {
    const synth = synthRef.current;
    if (!synth || !ligado || !texto) return;
    const limpo = texto.replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim();
    if (!limpo) return;

    const executar = () => {
      try {
        if (synth.speaking || synth.pending) synth.cancel();
        if (synth.paused) synth.resume();
        const u = criarUtterance(limpo);
        u.onstart = () => setFalando(true);
        u.onend = () => setFalando(false);
        u.onerror = () => setFalando(false);
        synth.speak(u);
      } catch { /* ignore */ }
    };

    // No iOS, um pequeno atraso após o cancel evita que a fala seja engolida.
    if (isIOS()) setTimeout(executar, 120);
    else executar();
  }, [ligado, criarUtterance]);

  return { suportado, ligado, falando, alternarLigado, falar, parar };
}
