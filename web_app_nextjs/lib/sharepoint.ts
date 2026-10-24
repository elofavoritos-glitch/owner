// Integração com o SharePoint da ELO via Microsoft Graph API (fluxo app-only /
// client credentials). Lista e baixa documentos de procedimentos comerciais para
// alimentar a base de conhecimento do assistente.
//
// Requer, nas env vars (Vercel):
//   ELO_GRAPH_TENANT_ID   — tenant da ELO (ex.: 3073b3c6-...)
//   ELO_GRAPH_CLIENT_ID   — app registration dedicado (com permissão Sites.Read.All)
//   ELO_GRAPH_CLIENT_SECRET — client secret desse app
//   ELO_SHAREPOINT_HOST   — host do SharePoint (ex.: intranetelo.sharepoint.com)
//   ELO_SHAREPOINT_SITE_PATH — caminho do site (ex.: /sites/DEPARTAMENTOS)
//
// Doc oficial (resumida): token em login.microsoftonline.com/{tenant}/oauth2/v2.0/token;
// site por path em /sites/{host}:{path}; arquivos em /sites/{id}/drive/root:/{pasta}:/children;
// conteúdo em /drives/{driveId}/items/{itemId}/content.

const GRAPH = "https://graph.microsoft.com/v1.0";

type GraphConfig = {
  tenant: string; clientId: string; clientSecret: string;
  host: string; sitePath: string;
};

function lerConfig(): GraphConfig | { erro: string } {
  const tenant = (process.env.ELO_GRAPH_TENANT_ID || "").trim();
  const clientId = (process.env.ELO_GRAPH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.ELO_GRAPH_CLIENT_SECRET || "").trim();
  const host = (process.env.ELO_SHAREPOINT_HOST || "").trim();
  const sitePath = (process.env.ELO_SHAREPOINT_SITE_PATH || "").trim();
  if (!tenant || !clientId || !clientSecret) {
    return { erro: "Integração SharePoint não configurada (faltam ELO_GRAPH_TENANT_ID / ELO_GRAPH_CLIENT_ID / ELO_GRAPH_CLIENT_SECRET)." };
  }
  if (!host || !sitePath) {
    return { erro: "Informe ELO_SHAREPOINT_HOST e ELO_SHAREPOINT_SITE_PATH." };
  }
  return { tenant, clientId, clientSecret, host, sitePath };
}

async function fetchTimeout(url: string, init: RequestInit = {}, ms = 20000): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal }); }
  finally { clearTimeout(t); }
}

// Token app-only (client credentials).
async function obterToken(cfg: GraphConfig): Promise<string | { erro: string }> {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  try {
    const r = await fetchTimeout(
      `https://login.microsoftonline.com/${cfg.tenant}/oauth2/v2.0/token`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() },
    );
    const j = await r.json();
    if (!r.ok) return { erro: `Falha ao autenticar no Graph (${j.error || r.status}): ${j.error_description?.split("\n")[0] || ""}` };
    return j.access_token as string;
  } catch {
    return { erro: "Falha de rede ao autenticar no Microsoft Graph." };
  }
}

async function graphGet(token: string, caminho: string): Promise<Response> {
  return fetchTimeout(`${GRAPH}${caminho}`, { headers: { Authorization: `Bearer ${token}` } });
}

export type ArquivoSharePoint = {
  id: string;
  nome: string;
  tamanho: number;
  modificadoEm: string | null;
  tipo: string; // extensão
  pasta: boolean;
  driveId: string;
};

// Extensões de arquivo cujo texto conseguimos extrair de forma confiável.
const EXTRAIVEIS = new Set(["txt", "md", "csv", "json", "docx"]);

function extensao(nome: string): string {
  const p = nome.lastIndexOf(".");
  return p >= 0 ? nome.slice(p + 1).toLowerCase() : "";
}

// Resolve o site e lista os arquivos de uma pasta (relativa à raiz do drive).
export async function listarArquivos(pastaRelativa: string): Promise<
  { ok: true; site: string; arquivos: ArquivoSharePoint[] } | { ok: false; erro: string }
> {
  const cfg = lerConfig();
  if ("erro" in cfg) return { ok: false, erro: cfg.erro };
  const token = await obterToken(cfg);
  if (typeof token !== "string") return { ok: false, erro: token.erro };

  // 1) site por path
  const siteResp = await graphGet(token, `/sites/${cfg.host}:${cfg.sitePath}`);
  const site = await siteResp.json();
  if (!siteResp.ok) return { ok: false, erro: `Site não encontrado (${site.error?.code || siteResp.status}). Confira ELO_SHAREPOINT_SITE_PATH.` };
  const siteId = site.id as string;

  // 2) drive padrão do site
  const driveResp = await graphGet(token, `/sites/${siteId}/drive`);
  const drive = await driveResp.json();
  if (!driveResp.ok) return { ok: false, erro: `Drive não encontrado (${drive.error?.code || driveResp.status}).` };
  const driveId = drive.id as string;

  // 3) filhos da pasta (ou raiz)
  const rel = pastaRelativa.replace(/^\/+|\/+$/g, "");
  const caminhoChildren = rel
    ? `/drives/${driveId}/root:/${encodeURI(rel)}:/children?$top=200`
    : `/drives/${driveId}/root/children?$top=200`;
  const childResp = await graphGet(token, caminhoChildren);
  const child = await childResp.json();
  if (!childResp.ok) return { ok: false, erro: `Pasta não encontrada (${child.error?.code || childResp.status}): "${rel}".` };

  const arquivos: ArquivoSharePoint[] = (child.value || []).map((it: Record<string, unknown>) => ({
    id: String(it.id),
    nome: String(it.name),
    tamanho: Number(it.size || 0),
    modificadoEm: (it.lastModifiedDateTime as string) || null,
    tipo: extensao(String(it.name)),
    pasta: Boolean(it.folder),
    driveId,
  }));
  return { ok: true, site: site.displayName || site.name || cfg.sitePath, arquivos };
}

// Baixa o conteúdo bruto de um arquivo (bytes).
export async function baixarArquivo(driveId: string, itemId: string): Promise<
  { ok: true; bytes: Buffer } | { ok: false; erro: string }
> {
  const cfg = lerConfig();
  if ("erro" in cfg) return { ok: false, erro: cfg.erro };
  const token = await obterToken(cfg);
  if (typeof token !== "string") return { ok: false, erro: token.erro };
  try {
    const r = await fetchTimeout(`${GRAPH}/drives/${driveId}/items/${itemId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    }, 30000);
    if (!r.ok) return { ok: false, erro: `Falha ao baixar o arquivo (HTTP ${r.status}).` };
    const buf = Buffer.from(await r.arrayBuffer());
    return { ok: true, bytes: buf };
  } catch {
    return { ok: false, erro: "Falha de rede ao baixar o arquivo." };
  }
}

// Extrai texto legível de um arquivo. Suporta txt/md/csv/json direto e docx
// (lê o document.xml de dentro do OOXML, que é um ZIP). Outros formatos (pdf,
// doc antigo, xlsx, pptx) não têm extração aqui — retorna aviso.
export async function extrairTexto(nome: string, bytes: Buffer): Promise<{ texto: string | null; aviso?: string }> {
  const ext = extensao(nome);
  if (["txt", "md", "csv", "json"].includes(ext)) {
    return { texto: bytes.toString("utf8") };
  }
  if (ext === "docx") {
    try {
      const { default: zlib } = await import("node:zlib");
      // docx é um ZIP; extraímos word/document.xml e tiramos as tags.
      const xml = extrairDoDocx(bytes, zlib);
      if (!xml) return { texto: null, aviso: "Não foi possível ler o .docx." };
      // <w:p> vira quebra de parágrafo; demais tags removidas.
      const texto = xml
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return { texto };
    } catch {
      return { texto: null, aviso: "Falha ao extrair texto do .docx." };
    }
  }
  return { texto: null, aviso: `Formato .${ext || "?"} não suportado para extração automática — baixe e cole o conteúdo, ou converta para .docx/.txt/.md.` };
}

// Lê word/document.xml de dentro de um .docx (ZIP) usando inflate nativo.
function extrairDoDocx(buf: Buffer, zlib: typeof import("node:zlib")): string | null {
  // Varre o ZIP procurando a entrada "word/document.xml" (método simples, sem lib).
  const alvo = Buffer.from("word/document.xml");
  let i = 0;
  while (i < buf.length - 4) {
    // local file header signature 0x04034b50
    if (buf.readUInt32LE(i) === 0x04034b50) {
      const metodo = buf.readUInt16LE(i + 8);
      const compSize = buf.readUInt32LE(i + 18);
      const nomeLen = buf.readUInt16LE(i + 26);
      const extraLen = buf.readUInt16LE(i + 28);
      const nome = buf.subarray(i + 30, i + 30 + nomeLen);
      const dadosIni = i + 30 + nomeLen + extraLen;
      if (nome.equals(alvo)) {
        const comp = buf.subarray(dadosIni, dadosIni + compSize);
        if (metodo === 0) return comp.toString("utf8");          // STORE
        if (metodo === 8) return zlib.inflateRawSync(comp).toString("utf8"); // DEFLATE
        return null;
      }
      i = dadosIni + compSize;
    } else {
      i++;
    }
  }
  return null;
}
