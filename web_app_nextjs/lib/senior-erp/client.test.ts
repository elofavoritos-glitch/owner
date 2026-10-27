import { describe, it, expect, vi } from "vitest";
import { SeniorClient, lerConfig, type SeniorConfig } from "./client";

const cfg: SeniorConfig = {
  baseUrl: "https://api.senior.com.br",
  authPath: "/platform/authentication/actions/loginWithKey",
  authMode: "key",
  accessKey: "ak_test",
  secret: "sk_test",
  tenant: "empresa.com.br",
};

const cfgPassword: SeniorConfig = {
  baseUrl: "https://api.senior.com.br",
  authPath: "/platform/authentication/actions/login",
  authMode: "password",
  username: "usuario@empresa",
  password: "senha-secreta",
  tenant: "empresa.com.br",
};

// Helper: cria uma Response-like mínima compatível com o que o cliente usa.
function resp(status: number, body: unknown): Response {
  const txt = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => txt,
  } as unknown as Response;
}

describe("lerConfig", () => {
  it("retorna null quando falta o tenant", () => {
    expect(lerConfig({})).toBeNull();
    expect(lerConfig({ SENIOR_ACCESS_KEY: "x", SENIOR_SECRET: "y" })).toBeNull();
  });

  it("retorna null quando o tenant existe mas nenhum par de credenciais está completo", () => {
    expect(lerConfig({ SENIOR_TENANT: "t", SENIOR_USERNAME: "u" })).toBeNull();
    expect(lerConfig({ SENIOR_TENANT: "t", SENIOR_ACCESS_KEY: "x" })).toBeNull();
  });

  it("usa modo 'password' com usuário/senha e o endpoint login", () => {
    const c = lerConfig({
      SENIOR_USERNAME: "u@e", SENIOR_PASSWORD: "p", SENIOR_TENANT: "t.com.br",
    });
    expect(c).not.toBeNull();
    expect(c!.authMode).toBe("password");
    expect(c!.authPath).toBe("/platform/authentication/actions/login");
    expect(c!.username).toBe("u@e");
    expect(c!.password).toBe("p");
  });

  it("usa modo 'key' com chave/segredo e o endpoint loginWithKey", () => {
    const c = lerConfig({
      SENIOR_ACCESS_KEY: "ak", SENIOR_SECRET: "sk", SENIOR_TENANT: "t.com.br",
    });
    expect(c!.authMode).toBe("key");
    expect(c!.authPath).toContain("loginWithKey");
  });

  it("dá prioridade a usuário/senha quando ambos os pares estão presentes", () => {
    const c = lerConfig({
      SENIOR_USERNAME: "u", SENIOR_PASSWORD: "p",
      SENIOR_ACCESS_KEY: "ak", SENIOR_SECRET: "sk",
      SENIOR_TENANT: "t",
    });
    expect(c!.authMode).toBe("password");
  });

  it("remove barra final da baseUrl customizada", () => {
    const c = lerConfig({
      SENIOR_ACCESS_KEY: "ak", SENIOR_SECRET: "sk", SENIOR_TENANT: "t",
      SENIOR_API_BASE_URL: "https://custom.senior.com.br/",
    });
    expect(c!.baseUrl).toBe("https://custom.senior.com.br");
  });

  it("SENIOR_AUTH_PATH explícito sobrepõe o default do modo", () => {
    const c = lerConfig({
      SENIOR_USERNAME: "u", SENIOR_PASSWORD: "p", SENIOR_TENANT: "t",
      SENIOR_AUTH_PATH: "/custom/auth",
    });
    expect(c!.authPath).toBe("/custom/auth");
  });
});

describe("SeniorClient.autenticar", () => {
  it("faz loginWithKey e devolve o token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { access_token: "tok-123", expires_in: 3600 }));
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);

    const r = await client.autenticar();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados.token).toBe("tok-123");

    // chamou o endpoint de auth com POST e corpo com a chave
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.senior.com.br/platform/authentication/actions/loginWithKey");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ access_key: "ak_test", secret: "sk_test" });
  });

  it("no modo password, envia username/senha para o endpoint login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { access_token: "tok-pw", expires_in: 3600 }));
    const client = new SeniorClient(cfgPassword, fetchMock as unknown as typeof fetch);

    const r = await client.autenticar();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados.token).toBe("tok-pw");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.senior.com.br/platform/authentication/actions/login");
    expect(JSON.parse(init.body)).toMatchObject({ username: "usuario@empresa", password: "senha-secreta" });
    // não deve vazar chaves no corpo
    expect(init.body).not.toContain("access_key");
  });

  it("reusa o token em cache (não autentica de novo)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { access_token: "tok-abc", expires_in: 3600 }));
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);

    await client.autenticar();
    await client.autenticar();
    expect(fetchMock).toHaveBeenCalledTimes(1); // segunda veio do cache
  });

  it("traduz credenciais inválidas (401) em mensagem clara", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(401, { message: "invalid key" }));
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);

    const r = await client.autenticar();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(401);
      expect(r.erro).toMatch(/inválid/i);
    }
  });

  it("erro claro quando o endpoint de auth não existe (404)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(404, { message: "not found" }));
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);
    const r = await client.autenticar();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/SENIOR_AUTH_PATH/);
  });

  it("falha se a resposta não traz token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { foo: "bar" }));
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);
    const r = await client.autenticar();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/sem token/i);
  });
});

describe("SeniorClient.chamar", () => {
  it("injeta o token no header Authorization e devolve os dados", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resp(200, { access_token: "tok-1", expires_in: 3600 })) // auth
      .mockResolvedValueOnce(resp(200, { produto: { codigo: 42, nome: "Pallet" } })); // chamada
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);

    const r = await client.chamar<{ produto: { codigo: number } }>("/erp/produtos/42");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados.produto.codigo).toBe(42);

    const [, init] = fetchMock.mock.calls[1];
    expect(init.headers.Authorization).toBe("tok-1");
  });

  it("renova o token automaticamente ao receber 401 e repete a chamada", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resp(200, { access_token: "tok-velho", expires_in: 3600 })) // auth inicial
      .mockResolvedValueOnce(resp(401, { message: "expired" }))                           // 1ª chamada: 401
      .mockResolvedValueOnce(resp(200, { access_token: "tok-novo", expires_in: 3600 }))   // re-auth
      .mockResolvedValueOnce(resp(200, { ok: true }));                                     // repete: sucesso
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);

    const r = await client.chamar("/erp/qualquer");
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // a última chamada usou o token novo
    const ultima = fetchMock.mock.calls[3];
    expect(ultima[1].headers.Authorization).toBe("tok-novo");
  });

  it("propaga erro de autenticação sem tentar a chamada de negócio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(401, { message: "bad creds" }));
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);
    const r = await client.chamar("/erp/produtos/1");
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // só a tentativa de auth
  });

  it("traduz 403 em mensagem sobre escopo/permissão", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resp(200, { access_token: "t", expires_in: 3600 }))
      .mockResolvedValueOnce(resp(403, { message: "forbidden" }));
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);
    const r = await client.chamar("/erp/restrito");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/permiss|escopo/i);
  });
});

describe("SeniorClient.fromEnv", () => {
  it("lança erro orientando as env vars quando faltam credenciais", () => {
    expect(() => SeniorClient.fromEnv({})).toThrow(/SENIOR_ACCESS_KEY/);
  });
});
