// Transcrição de áudio via Whisper da Groq (funciona em qualquer navegador,
// incluindo Safari/iOS — ao contrário da Web Speech API do navegador).
// Recebe um arquivo de áudio (multipart) e devolve o texto transcrito em PT-BR.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODELO = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: Request) {
  // Exige usuário autenticado.
  const supabase = supabaseServer();
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ erro: "Transcrição indisponível (GROQ_API_KEY não configurada)." }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });

  const audio = form.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ erro: "Nenhum áudio enviado." }, { status: 400 });
  if (audio.size === 0) return NextResponse.json({ erro: "Áudio vazio." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ erro: "Áudio muito longo (máx. 20 MB)." }, { status: 400 });

  // Repassa o áudio para a API de transcrição da Groq.
  const groqForm = new FormData();
  groqForm.append("file", audio, audio.name || "audio.webm");
  groqForm.append("model", MODELO);
  groqForm.append("language", "pt");
  groqForm.append("response_format", "json");

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
    });
    if (!r.ok) {
      const detalhe = await r.text();
      console.error("Groq Whisper:", r.status, detalhe.slice(0, 300));
      const msg = r.status === 401 ? "GROQ_API_KEY inválida."
        : r.status === 429 ? "Limite de uso da Groq atingido. Tente em instantes."
        : "Falha na transcrição.";
      return NextResponse.json({ erro: msg, status: r.status }, { status: 502 });
    }
    const data = (await r.json()) as { text?: string };
    return NextResponse.json({ texto: (data.text ?? "").trim() });
  } catch (e) {
    console.error("transcrever:", e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: "Falha ao transcrever o áudio." }, { status: 500 });
  }
}
