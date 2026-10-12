"use client";
// Hook de fala (text-to-speech) usando a Web Speech Synthesis do navegador.
// Grátis, sem servidor, funciona no iPhone/Safari (a parte de FALAR da Apple
// funciona bem). Lê texto em PT-BR. O usuário liga/desliga via um botão.
import { useCallback, useEffect, useRef, useState } from "react";

export function useFala() {
  const [suportado, setSuportado] = useState(false);
  // Preferência persistida: a voz fica ligada se o usuário tiver ativado antes.
  const [ligado, setLigado] = useState(false);
  const [falando, setFalando] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSuportado(ok);
    if (ok) synthRef.current = window.speechSynthesis;
    try {
      setLigado(localStorage.getItem("elo-voz") === "1");
    } catch { /* ignore */ }
    return () => {
      try { synthRef.current?.cancel(); } catch { /* ignore */ }
    };
  }, []);

  const destravadoRef = useRef(false);

  // iOS/Safari só permite áudio iniciado por gesto do usuário. Ao tocar no botão,
  // disparamos um utterance mínimo DENTRO do gesto para "destravar" o
  // speechSynthesis pelo resto da sessão.
  const destravar = useCallback(() => {
    const synth = synthRef.current;
    if (!synth || destravadoRef.current) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0; // silencioso, só para liberar o canal de áudio no iOS
      u.lang = "pt-BR";
      synth.speak(u);
      destravadoRef.current = true;
    } catch { /* ignore */ }
  }, []);

  const alternarLigado = useCallback(() => {
    setLigado((v) => {
      const novo = !v;
      try { localStorage.setItem("elo-voz", novo ? "1" : "0"); } catch { /* ignore */ }
      if (novo) {
        destravar(); // libera o áudio no iOS neste toque
      } else {
        try { synthRef.current?.cancel(); } catch { /* ignore */ }
        setFalando(false);
      }
      return novo;
    });
  }, [destravar]);

  const parar = useCallback(() => {
    try { synthRef.current?.cancel(); } catch { /* ignore */ }
    setFalando(false);
  }, []);

  // Lê o texto em voz alta (só se estiver ligado). Remove markdown básico.
  const falar = useCallback((texto: string) => {
    const synth = synthRef.current;
    if (!synth || !ligado || !texto) return;
    const limpo = texto
      .replace(/[*_#`>]/g, "")      // markdown
      .replace(/\s+/g, " ")
      .trim();
    if (!limpo) return;
    try {
      synth.cancel(); // interrompe fala anterior
      // iOS às vezes deixa o synth "pausado" — garante retomada.
      if (synth.paused) synth.resume();
      const u = new SpeechSynthesisUtterance(limpo);
      u.lang = "pt-BR";
      u.rate = 1.05;
      u.onstart = () => setFalando(true);
      u.onend = () => setFalando(false);
      u.onerror = () => setFalando(false);
      // prefere uma voz pt-BR, se houver (no iOS as vozes podem demorar a carregar)
      const vozes = synth.getVoices();
      const ptbr = vozes.find((v) => v.lang?.toLowerCase().startsWith("pt"));
      if (ptbr) u.voice = ptbr;
      synth.speak(u);
    } catch { /* ignore */ }
  }, [ligado]);

  return { suportado, ligado, falando, alternarLigado, falar, parar };
}
