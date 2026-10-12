// Gera uma URL assinada temporária para baixar/visualizar um documento privado.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = supabaseServer();
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ erro: "Informe o id." }, { status: 400 });

  const { data: doc, error } = await supabase
    .from("documentos")
    .select("caminho")
    .eq("id", id)
    .maybeSingle();
  if (error || !doc) return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });

  // URL válida por 60 segundos.
  const { data: signed, error: sErr } = await supabase.storage
    .from("documentos")
    .createSignedUrl(doc.caminho, 60);
  if (sErr || !signed) return NextResponse.json({ erro: "Falha ao gerar link." }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
