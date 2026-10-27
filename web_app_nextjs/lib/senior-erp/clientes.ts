// ===================== SENIOR ERP — Cadastro de Clientes =====================
// Exporta o cadastro de clientes do Gestão Empresarial | ERP via o web service
// SOAP `com.senior.g5.co.cad.clientes`, porta `exportar`, autenticado com o
// token da Senior X (ver client.ts / chamarSoap).
//
// Doc oficial (reformulado p/ conformidade de licença):
//   https://documentacao.senior.com.br/goup/5.10.3/webservices/com_senior_g5_co_cad_clientes.htm
//   "O serviço de Cliente permite a exportação de registros com controle de
//    integração utilizando a porta exportar."
//
// Campos principais confirmados na doc: codCli, nomCli, cgcCpf, sitCli, além de
// blocos de endereços e contatos. Este módulo extrai um subconjunto útil para
// relatório; o XML cru fica disponível para quem precisar de mais campos.
import { SeniorClient, type SeniorResposta } from "./client";

const SERVICO = "com.senior.g5.co.cad.clientes";
const PORTA = "exportar";

export type ClienteSenior = {
  codigo: string;      // codCli
  nome: string;        // nomCli (razão social / nome)
  cnpjCpf: string;     // cgcCpf
  situacao: string;    // sitCli (ex.: A=ativo)
  cidade?: string;
  uf?: string;
};

/**
 * Exporta clientes do ERP. `filtros` monta o <params> do request SOAP.
 * Sem filtros, pede todos (respeitando o que o serviço/abrangência permite).
 */
export async function exportarClientes(
  client: SeniorClient,
  filtros: { codigoInicial?: string; codigoFinal?: string; situacao?: string } = {},
): Promise<SeniorResposta<ClienteSenior[]>> {
  // Monta o XML de parâmetros a partir dos filtros informados (nunca inventa).
  const params =
    (filtros.codigoInicial ? tag("codCliIni", filtros.codigoInicial) : "") +
    (filtros.codigoFinal ? tag("codCliFim", filtros.codigoFinal) : "") +
    (filtros.situacao ? tag("sitCli", filtros.situacao) : "");

  const resp = await client.chamarSoap(SERVICO, PORTA, params);
  if (!resp.ok) return resp;

  return { ok: true, dados: parseClientes(resp.dados), status: resp.status };
}

// ----- Parsing do XML de resposta (sem dependências externas) -----

/** Extrai os clientes do XML de resposta do WS exportar. */
export function parseClientes(xml: string): ClienteSenior[] {
  const clientes: ClienteSenior[] = [];
  // Cada cliente costuma vir num bloco <cliente>...</cliente> (ou <clientes>).
  const blocos = xml.match(/<cliente[\s>][\s\S]*?<\/cliente>/gi) ?? [];
  for (const b of blocos) {
    const codigo = campo(b, "codCli");
    const nome = campo(b, "nomCli") || campo(b, "razSoc") || campo(b, "nomFan");
    // só considera registros que tenham ao menos código ou nome
    if (!codigo && !nome) continue;
    clientes.push({
      codigo,
      nome,
      cnpjCpf: campo(b, "cgcCpf") || campo(b, "cgcCli"),
      situacao: campo(b, "sitCli"),
      cidade: campo(b, "nomMun") || campo(b, "cidCli") || undefined,
      uf: campo(b, "sigUfs") || campo(b, "ufsCli") || undefined,
    });
  }
  return clientes;
}

/** Lê o valor de uma tag XML simples dentro de um trecho. */
function campo(xml: string, nome: string): string {
  const m = new RegExp(`<${nome}>([\\s\\S]*?)</${nome}>`, "i").exec(xml);
  return m ? desescXml(m[1].trim()) : "";
}

function tag(nome: string, valor: string): string {
  return `&lt;${nome}&gt;${escXmlInterno(valor)}&lt;/${nome}&gt;`;
}

function escXmlInterno(s: string): string {
  return String(s).replace(/&/g, "&amp;amp;").replace(/</g, "&amp;lt;").replace(/>/g, "&amp;gt;");
}

function desescXml(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
