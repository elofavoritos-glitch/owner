import { describe, it, expect, vi } from "vitest";
import { SeniorClient, type SeniorConfig } from "./client";
import { exportarClientes, parseClientes } from "./clientes";

const cfg: SeniorConfig = {
  baseUrl: "https://api.senior.com.br",
  authPath: "/platform/authentication/actions/login",
  authMode: "password",
  username: "intapi@elo.log.br",
  password: "x",
  tenant: "elo.log.br",
  soapExec: "sapiens",
  soapUser: "intapi",
};

function resp(status: number, body: string, contentType = "text/xml"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    headers: { get: () => contentType },
  } as unknown as Response;
}

const AUTH_OK = JSON.stringify({ jsonToken: JSON.stringify({ access_token: "tok", expires_in: 3600 }) });

const XML_CLIENTES = `<?xml version="1.0"?><result>
  <cliente><codCli>1001</codCli><nomCli>Transportadora Horizonte LTDA</nomCli>
    <cgcCpf>12345678000190</cgcCpf><sitCli>A</sitCli><nomMun>Itajaí</nomMun><sigUfs>SC</sigUfs></cliente>
  <cliente><codCli>1002</codCli><nomCli>Armazéns Litoral S.A.</nomCli>
    <cgcCpf>98765432000110</cgcCpf><sitCli>A</sitCli><nomMun>Navegantes</nomMun><sigUfs>SC</sigUfs></cliente>
</result>`;

describe("parseClientes", () => {
  it("extrai múltiplos clientes do XML", () => {
    const lista = parseClientes(XML_CLIENTES);
    expect(lista).toHaveLength(2);
    expect(lista[0]).toMatchObject({
      codigo: "1001", nome: "Transportadora Horizonte LTDA",
      cnpjCpf: "12345678000190", situacao: "A", cidade: "Itajaí", uf: "SC",
    });
    expect(lista[1].codigo).toBe("1002");
  });

  it("ignora blocos sem código nem nome", () => {
    expect(parseClientes("<result><cliente><sitCli>A</sitCli></cliente></result>")).toHaveLength(0);
  });

  it("retorna vazio para XML sem clientes", () => {
    expect(parseClientes("<result></result>")).toHaveLength(0);
  });

  it("desescapa entidades XML no conteúdo", () => {
    const xml = "<cliente><codCli>5</codCli><nomCli>A &amp; B Log</nomCli></cliente>";
    expect(parseClientes(xml)[0].nome).toBe("A & B Log");
  });
});

describe("exportarClientes", () => {
  it("autentica, chama o WS SOAP de clientes e devolve a lista parseada", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resp(200, AUTH_OK, "application/json")) // login
      .mockResolvedValueOnce(resp(200, XML_CLIENTES));               // SOAP exportar
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);

    const r = await exportarClientes(client);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados).toHaveLength(2);
      expect(r.dados[0].nome).toContain("Horizonte");
    }

    // confirma que chamou o endpoint SOAP correto, com o token no header
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain("/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes");
    expect(init.headers.Authorization).toBe("tok");
    expect(init.body).toContain("com.senior.g5.co.cad.clientes@exportar");
  });

  it("propaga falha SOAP (faultstring vem com HTTP 200)", async () => {
    const fault = `<S:Envelope><S:Body><S:Fault><faultstring>Usuário sem permissão</faultstring></S:Fault></S:Body></S:Envelope>`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resp(200, AUTH_OK, "application/json"))
      .mockResolvedValueOnce(resp(200, fault));
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);

    const r = await exportarClientes(client);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/permiss/i);
  });

  it("propaga erro de autenticação sem chamar o WS", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(401, JSON.stringify({ message: "bad" }), "application/json"));
    const client = new SeniorClient(cfg, fetchMock as unknown as typeof fetch);
    const r = await exportarClientes(client);
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
