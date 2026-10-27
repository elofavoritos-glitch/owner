// ===================== SENIOR X — Plataforma Senior (Gestão Empresarial | ERP) =====================
// Cliente REST para a Plataforma Senior X (Senior Cloud).
//
// Autenticação (confirmado na doc oficial da Senior):
//   - Integração servidor-a-servidor usa uma Chave de Aplicação (access key +
//     secret) via a primitiva `loginWithKey`, que devolve um token.
//   - O token é enviado no header `Authorization` em todas as chamadas às APIs
//     da plataforma, e tem validade de alguns dias; ao expirar/falhar, renova-se
//     com a chave.
//   Refs (reformulado p/ conformidade de licença):
//     https://dev.senior.com.br/autenticacao-na-plataforma/
//     https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/vendas/integracao-pedido-venda-api.htm
//     https://documentacao.senior.com.br/gestaodearmazenagemwms/8.11/manuais-wms/integracao/api-erp-v2.html
//
// IMPORTANTE — endpoints parametrizáveis:
//   O path exato do loginWithKey e das APIs de negócio varia por serviço/tenant
//   e DEVE ser confirmado na doc/no ambiente do cliente. Por isso são lidos de
//   env vars (SENIOR_API_BASE_URL, SENIOR_AUTH_PATH) com defaults que seguem o
//   padrão da plataforma, mas que podem ser ajustados sem mexer no código.
//   Nunca inventar endpoint/campo: na dúvida, confirmar na documentação oficial.

// ----- Configuração via ambiente (segredos nunca ficam no repo) -----
// A Plataforma Senior X suporta duas formas de autenticação servidor-a-servidor:
//   - "password": login com USUÁRIO + SENHA (primitiva `login`).
//   - "key":      login com CHAVE + SEGREDO (primitiva `loginWithKey`).
// O modo é escolhido automaticamente pelas variáveis presentes (ver lerConfig):
// se houver SENIOR_USERNAME + SENIOR_PASSWORD usa "password"; senão, se houver
// SENIOR_ACCESS_KEY + SENIOR_SECRET usa "key".
export type SeniorAuthMode = "password" | "key";

export type SeniorConfig = {
  baseUrl: string;   // ex.: https://api.senior.com.br
  authPath: string;  // path da primitiva de autenticação
  authMode: SeniorAuthMode;
  tenant: string;    // domínio do tenant (ex.: suaempresa.com.br)
  // credenciais (preenchidas conforme o modo)
  username?: string; // modo "password"
  password?: string; // modo "password"
  accessKey?: string; // modo "key"
  secret?: string;    // modo "key"
};

const DEFAULT_BASE_URL = "https://api.senior.com.br";
// Defaults seguem o padrão público da plataforma; confirme o path no seu tenant.
// Cada primitiva tem seu endpoint próprio.
const DEFAULT_AUTH_PATH_PASSWORD = "/platform/authentication/actions/login";
const DEFAULT_AUTH_PATH_KEY = "/platform/authentication/actions/loginWithKey";

/** Fonte de variáveis de ambiente (compatível com process.env). */
export type EnvVars = Record<string, string | undefined>;

/**
 * Lê a configuração do ambiente e detecta o modo de autenticação.
 * Prioriza usuário/senha (modo "password") quando ambos estão presentes;
 * do contrário, usa chave/segredo (modo "key"). Retorna null se nenhum par
 * de credenciais estiver completo (ou faltar o tenant).
 */
export function lerConfig(env: EnvVars = process.env): SeniorConfig | null {
  const tenant = (env.SENIOR_TENANT || "").trim();
  if (!tenant) return null;

  const baseUrl = (env.SENIOR_API_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  const authPathEnv = (env.SENIOR_AUTH_PATH || "").trim();

  const username = (env.SENIOR_USERNAME || "").trim();
  const password = (env.SENIOR_PASSWORD || "").trim();
  const accessKey = (env.SENIOR_ACCESS_KEY || "").trim();
  const secret = (env.SENIOR_SECRET || "").trim();

  // Modo usuário/senha tem prioridade quando informado por completo.
  if (username && password) {
    return {
      baseUrl,
      authPath: authPathEnv || DEFAULT_AUTH_PATH_PASSWORD,
      authMode: "password",
      tenant,
      username,
      password,
    };
  }

  if (accessKey && secret) {
    return {
      baseUrl,
      authPath: authPathEnv || DEFAULT_AUTH_PATH_KEY,
      authMode: "key",
      tenant,
      accessKey,
      secret,
    };
  }

  return null;
}

// ----- Tipos de retorno (mesmo estilo dos demais serviços externos do projeto) -----
export type SeniorOk<T = unknown> = { ok: true; dados: T; status: number };
export type SeniorErro = { ok: false; erro: string; status?: number };
export type SeniorResposta<T = unknown> = SeniorOk<T> | SeniorErro;

type TokenCache = { token: string; expiraEm: number }; // epoch ms

// ----- Cliente -----
export class SeniorClient {
  private cfg: SeniorConfig;
  private cache: TokenCache | null = null;
  // fetch injetável para testes (default: global fetch).
  private fetchImpl: typeof fetch;

  constructor(cfg: SeniorConfig, fetchImpl: typeof fetch = fetch) {
    this.cfg = cfg;
    this.fetchImpl = fetchImpl;
  }

  /** Cria um cliente a partir do ambiente, ou lança se a config estiver incompleta. */
  static fromEnv(env: EnvVars = process.env, fetchImpl: typeof fetch = fetch): SeniorClient {
    const cfg = lerConfig(env);
    if (!cfg) {
      throw new Error(
        "Integração Senior X indisponível: defina SENIOR_TENANT e um par de credenciais — " +
          "SENIOR_USERNAME + SENIOR_PASSWORD (usuário/senha) ou SENIOR_ACCESS_KEY + SENIOR_SECRET (chave).",
      );
    }
    return new SeniorClient(cfg, fetchImpl);
  }

  private tokenValido(agora = Date.now()): boolean {
    // margem de 60s para evitar usar um token prestes a expirar.
    return !!this.cache && this.cache.expiraEm - 60_000 > agora;
  }

  /**
   * Monta o corpo da requisição de autenticação conforme o modo configurado:
   *   - "password": { username, password }  (primitiva `login`)
   *   - "key":      { access_key, secret }  (primitiva `loginWithKey`)
   */
  private corpoAutenticacao(): Record<string, string> {
    if (this.cfg.authMode === "password") {
      return { username: this.cfg.username ?? "", password: this.cfg.password ?? "" };
    }
    return { access_key: this.cfg.accessKey ?? "", secret: this.cfg.secret ?? "" };
  }

  /**
   * Autentica na plataforma (via `login` com usuário/senha, ou `loginWithKey`
   * com chave/segredo, conforme a config) e devolve o token (cacheado enquanto
   * válido). `forcar` ignora o cache (usado ao receber 401 numa chamada).
   */
  async autenticar(forcar = false, timeoutMs = 20_000): Promise<SeniorResposta<{ token: string }>> {
    if (!forcar && this.tokenValido()) {
      return { ok: true, dados: { token: this.cache!.token }, status: 200 };
    }

    const url = `${this.cfg.baseUrl}${this.cfg.authPath}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(this.corpoAutenticacao()),
        signal: controller.signal,
      });

      const txt = await resp.text();
      let json: Record<string, unknown> = {};
      try { json = txt ? JSON.parse(txt) : {}; } catch { /* corpo não-JSON */ }

      if (!resp.ok) {
        return { ok: false, status: resp.status, erro: traduzErroAuth(resp.status, pegarDetalhe(json, txt)) };
      }

      // A plataforma pode devolver o token em chaves diferentes conforme o serviço.
      const token = String(json.access_token ?? json.token ?? json.jwt ?? "").trim();
      if (!token) {
        return { ok: false, status: resp.status, erro: "Autenticação Senior X: resposta sem token." };
      }

      // expires_in costuma vir em segundos; sem ele, assume 1h de validade.
      const expiresInSeg = Number(json.expires_in ?? json.expiresIn);
      const ttlMs = Number.isFinite(expiresInSeg) && expiresInSeg > 0 ? expiresInSeg * 1000 : 3_600_000;
      this.cache = { token, expiraEm: Date.now() + ttlMs };

      return { ok: true, dados: { token }, status: resp.status };
    } catch (e) {
      return { ok: false, erro: `Falha ao autenticar na Senior X (${descreverErroRede(e)}).` };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Chama um endpoint de negócio da plataforma com o token no header.
   * `caminho` é relativo à baseUrl (ex.: "/erp/.../queries/consultarProduto").
   * Renova o token automaticamente uma vez em caso de 401.
   */
  async chamar<T = unknown>(
    caminho: string,
    opts: { metodo?: "GET" | "POST" | "PUT" | "DELETE"; corpo?: unknown; timeoutMs?: number } = {},
  ): Promise<SeniorResposta<T>> {
    const { metodo = "GET", corpo, timeoutMs = 20_000 } = opts;

    const auth = await this.autenticar();
    if (!auth.ok) return auth;

    const fazer = async (token: string): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await this.fetchImpl(`${this.cfg.baseUrl}${caminho}`, {
          method: metodo,
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      let resp = await fazer(auth.dados.token);

      // Token expirado/revogado: renova uma vez e repete.
      if (resp.status === 401) {
        const renovado = await this.autenticar(true);
        if (!renovado.ok) return renovado;
        resp = await fazer(renovado.dados.token);
      }

      const txt = await resp.text();
      let json: unknown = null;
      try { json = txt ? JSON.parse(txt) : null; } catch { json = txt; }

      if (!resp.ok) {
        return {
          ok: false,
          status: resp.status,
          erro: traduzErroChamada(resp.status, pegarDetalhe(json as Record<string, unknown>, txt)),
        };
      }
      return { ok: true, dados: json as T, status: resp.status };
    } catch (e) {
      return { ok: false, erro: `Falha ao chamar a API Senior X (${descreverErroRede(e)}).` };
    }
  }
}

// ----- Helpers de erro (mensagens em linguagem clara, como nos demais serviços) -----
function pegarDetalhe(json: Record<string, unknown> | null, bruto: string): string {
  if (json && typeof json === "object") {
    const d = (json.message ?? json.detail ?? json.error ?? json.error_description) as string | undefined;
    if (d) return String(d);
  }
  return (bruto || "").slice(0, 200);
}

function traduzErroAuth(status: number, detalhe: string): string {
  if (status === 400 || status === 401) {
    return "Credenciais Senior X inválidas (usuário/senha ou chave/segredo, e tenant). Verifique as credenciais informadas.";
  }
  if (status === 403) return "Sem permissão para autenticar na Senior X com esta chave.";
  if (status === 404) return "Endpoint de autenticação Senior X não encontrado. Confirme SENIOR_AUTH_PATH.";
  if (status >= 500) return "Instabilidade na plataforma Senior X. Tente novamente.";
  return `Falha na autenticação Senior X (HTTP ${status}): ${detalhe}`;
}

function traduzErroChamada(status: number, detalhe: string): string {
  if (status === 401) return "Token Senior X inválido/expirado e não foi possível renovar.";
  if (status === 403) return "Sem permissão para este recurso na Senior X (verifique o escopo da chave).";
  if (status === 404) return "Recurso Senior X não encontrado. Confirme o endpoint na documentação oficial.";
  if (status === 422) return `Dados rejeitados pela Senior X: ${detalhe}`;
  if (status >= 500) return "Instabilidade na plataforma Senior X. Tente novamente.";
  return `Falha na chamada Senior X (HTTP ${status}): ${detalhe}`;
}

function descreverErroRede(e: unknown): string {
  if (e instanceof Error && e.name === "AbortError") return "tempo de resposta esgotado";
  return e instanceof Error ? e.message : String(e);
}
