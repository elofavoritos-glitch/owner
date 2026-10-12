// Importação de planilha (xlsx/csv) para clientes ou oportunidades.
// Fluxo em 2 passos: 'previa' (lê e mostra o que entendeu, sem gravar) e
// 'confirmar' (grava os registros). Nunca grava sem a confirmação.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import {
  lerPlanilha, mapearColunas, montarRegistros,
  CAMPOS_OBRIGATORIOS, type Destino,
} from "@/lib/planilha";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DESTINOS: Destino[] = ["clientes", "oportunidades"];
const MAX_BYTES = 10 * 1024 * 1024;

async function getUser() {
  const supabase = supabaseServer();
  try {
    const { data } = await supabase.auth.getUser();
    return { supabase, user: data.user };
  } catch {
    return { supabase, user: null };
  }
}

export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });

  const acao = String(form.get("acao") ?? "previa");
  const destino = String(form.get("destino") ?? "") as Destino;
  if (!DESTINOS.includes(destino)) {
    return NextResponse.json({ erro: "Destino inválido (clientes ou oportunidades)." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ erro: "Arquivo acima de 10 MB." }, { status: 400 });

  let planilha;
  try {
    planilha = lerPlanilha(await file.arrayBuffer());
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Falha ao ler a planilha." }, { status: 400 });
  }

  // Permite ao usuário sobrescrever o mapeamento (JSON opcional no form).
  let mapa = mapearColunas(planilha.cabecalhos, destino);
  const mapaCustom = form.get("mapa");
  if (typeof mapaCustom === "string" && mapaCustom.trim()) {
    try { mapa = JSON.parse(mapaCustom); } catch { /* ignora, usa o automático */ }
  }

  const { registros, ignoradas } = montarRegistros(planilha, destino, mapa);

  // ---------- PRÉVIA (não grava) ----------
  if (acao === "previa") {
    return NextResponse.json({
      destino,
      cabecalhos: planilha.cabecalhos,
      mapa,
      campo_obrigatorio: CAMPOS_OBRIGATORIOS[destino],
      total_linhas: planilha.linhas.length,
      validos: registros.length,
      ignoradas,
      amostra: registros.slice(0, 10),
    });
  }

  // ---------- CONFIRMAR (grava) ----------
  if (acao === "confirmar") {
    if (!registros.length) return NextResponse.json({ erro: "Nenhum registro válido para importar." }, { status: 400 });

    // enriquecer com responsável
    const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
    const respNome = perfil?.nome || user.email || null;
    const comResp = registros.map((r) => ({
      ...r,
      responsavel_id: user.id,
      responsavel_nome: r.responsavel_nome || respNome,
    }));

    // Insere em lotes para não estourar memória/timeout com planilhas grandes.
    const LOTE = 500;
    let inseridos = 0;
    for (let i = 0; i < comResp.length; i += LOTE) {
      const chunk = comResp.slice(i, i + LOTE);
      const { data, error } = await supabase.from(destino).insert(chunk).select("id");
      if (error) {
        console.error("POST /api/importar:", error.message);
        return NextResponse.json(
          { erro: "Falha ao importar. Verifique os dados da planilha.", inseridos },
          { status: 500 },
        );
      }
      inseridos += data?.length ?? 0;
    }
    return NextResponse.json({ ok: true, inseridos, ignoradas });
  }

  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}
