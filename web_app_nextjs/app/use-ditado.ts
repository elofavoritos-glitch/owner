"use client";
// Ditado por voz via gravação de áudio + transcrição no servidor (Whisper/Groq).
// Funciona em QUALQUER navegador, incluindo Safari/iOS — ao contrário da Web
// Speech API nativa. Fluxo: toca para gravar → fala → toca para parar → o áudio
// é enviado para /api/transcrever → o texto transcrito volta via onTexto.
import { useCallback, useEffect, useRef, useState } from "react";

export function useDitado(onTexto: (texto: string) => void) {
  const [suportado, setSuportado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);      // gravando
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cbRef = useRef(onTexto);
  cbRef.current = onTexto;

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const ok = typeof window !== "undefined"
      && typeof navigator !== "undefined"
      && !!navigator.mediaDevices?.getUserMedia
      && typeof window.MediaRecorder !== "undefined";
    setSuportado(ok);
    return () => {
      try { mediaRef.current?.stop(); } catch { /* ignore */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function transcrever(blob: Blob) {
    setTranscrevendo(true);
    setErro(null);
    try {
      const fd = new FormData();
      // extensão coerente com o mime (webm no Chrome/Android, mp4/m4a no Safari)
      const ext = blob.type.includes("mp4") || blob.type.includes("m4a") ? "mp4"
        : blob.type.includes("ogg") ? "ogg" : "webm";
      fd.append("audio", blob, `audio.${ext}`);
      const r = await fetch("/api/transcrever", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro || "Falha ao transcrever.");
      } else if (d.texto) {
        cbRef.current(d.texto);
      } else {
        setErro("Não entendi o áudio. Tente falar de novo.");
      }
    } catch {
      setErro("Erro de conexão ao transcrever.");
    } finally {
      setTranscrevendo(false);
    }
  }

  const parar = useCallback(() => {
    try { mediaRef.current?.stop(); } catch { /* ignore */ }
    setOuvindo(false);
  }, []);

  const iniciar = useCallback(async () => {
    setErro(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("Seu navegador não permite gravar áudio.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErro("Permissão de microfone negada. Autorize o microfone no navegador.");
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];

    // Escolhe um mimeType suportado (Safari não suporta webm).
    let mime = "";
    const candidatos = ["audio/webm", "audio/mp4", "audio/ogg", ""];
    for (const c of candidatos) {
      if (c === "" || (window.MediaRecorder.isTypeSupported?.(c) ?? false)) { mime = c; break; }
    }

    let mr: MediaRecorder;
    try {
      mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      mr = new MediaRecorder(stream);
    }
    mediaRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const tipo = mr.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: tipo });
      if (blob.size > 0) transcrever(blob);
    };

    try {
      mr.start();
      setOuvindo(true);
    } catch {
      setErro("Não foi possível iniciar a gravação.");
      stream.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const alternar = useCallback(() => {
    if (ouvindo) parar();
    else iniciar();
  }, [ouvindo, parar, iniciar]);

  return { suportado, ouvindo, transcrevendo, erro, alternar, parar };
}
