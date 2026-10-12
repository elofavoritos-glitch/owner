// Text-to-speech via Google Cloud TTS (voz natural PT-BR). Gera o áudio no
// servidor e devolve MP3 — funciona em qualquer navegador, inclusive Safari/iOS,
// pois o cliente apenas toca um arquivo de áudio.
//
// Requer a env var GOOGLE_TTS_API_KEY (chave de API do Google Cloud com a
// Cloud Text-to-Speech API habilitada). Sem ela, retorna 503 e o app cai para
// o TTS do navegador.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Voz PT-BR natural (feminina). Chirp3-HD é o estado da arte do Google. Configurável.
const VOZ = process.env.GOOGLE_TTS_VOICE || "pt-BR-Chirp3-HD-Leda";
const MAX_CHARS = 1500;

export async function POST(request: Request) {
  const supabase = supabaseServer();
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ erro: "TTS não configurado." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { texto?: string };
  const texto = String(body.texto ?? "").replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (!texto) return NextResponse.json({ erro: "Texto vazio." }, { status: 400 });

  try {
    const r = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: texto },
          voice: { languageCode: "pt-BR", name: VOZ },
          // Chirp3-HD não aceita speakingRate; só aplica nas demais vozes.
          audioConfig: VOZ.includes("Chirp3")
            ? { audioEncoding: "MP3" }
            : { audioEncoding: "MP3", speakingRate: 1.03 },
        }),
      },
    );
    if (!r.ok) {
      const detalhe = await r.text();
      console.error("Google TTS:", r.status, detalhe.slice(0, 300));
      const msg = r.status === 400 || r.status === 403 ? "Chave do Google TTS inválida ou API não habilitada."
        : r.status === 429 ? "Limite do Google TTS atingido."
        : "Falha ao gerar o áudio.";
      return NextResponse.json({ erro: msg, status: r.status }, { status: 502 });
    }
    const data = (await r.json()) as { audioContent?: string };
    if (!data.audioContent) return NextResponse.json({ erro: "Resposta de áudio vazia." }, { status: 502 });

    // audioContent vem em base64; devolve como MP3 binário.
    const buffer = Buffer.from(data.audioContent, "base64");
    return new NextResponse(buffer, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("falar:", e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: "Falha ao gerar o áudio." }, { status: 500 });
  }
}
