import { describe, expect, it } from "vitest";
import { decodificarCorpo, normalizarDocumento, parseCorpo } from "./recebimento";

describe("decodificarCorpo", () => {
  it("lê windows-1252 por padrão (padrão do ERP)", () => {
    const bytes = new Uint8Array([0x53, 0xc3, 0x4f]).buffer; // "SÃO" em windows-1252
    expect(decodificarCorpo(bytes, "text/plain")).toBe("SÃO");
    expect(decodificarCorpo(bytes, null)).toBe("SÃO");
  });

  it("respeita charset=utf-8", () => {
    const bytes = new TextEncoder().encode("SÃO").buffer;
    expect(decodificarCorpo(bytes as ArrayBuffer, "text/plain; charset=UTF-8")).toBe("SÃO");
  });
});

describe("normalizarDocumento", () => {
  it("recoloca zeros à esquerda de CNPJ e CPF", () => {
    expect(normalizarDocumento("1234567000199", "J")).toBe("01234567000199");
    expect(normalizarDocumento("1234567890", "F")).toBe("01234567890");
  });

  it("descarta documento vazio ou zerado", () => {
    expect(normalizarDocumento("0", "J")).toBe("");
    expect(normalizarDocumento("", "J")).toBe("");
  });
});

describe("parseCorpo", () => {
  it("monta clientes a partir do formato ELO1", () => {
    const corpo =
      "ELO1~10|ACME LTDA|ACME|J|1234567000199|São Paulo|sp|11 3333-4444|Compras@Acme.com.br|A" +
      "~11|  JOAO  DA SILVA |  |F|12345678901|Campinas|SP|||I";
    const { clientes, ignorados } = parseCorpo(corpo);
    expect(ignorados).toEqual([]);
    expect(clientes).toEqual([
      {
        codigo: 10, empresa: "ACME LTDA", fantasia: "ACME", cnpj: "01234567000199",
        cidade: "São Paulo", uf: "SP", telefone: "11 3333-4444", email: "compras@acme.com.br", situacao: "A",
      },
      {
        codigo: 11, empresa: "JOAO DA SILVA", fantasia: "", cnpj: "12345678901",
        cidade: "Campinas", uf: "SP", telefone: "", email: "", situacao: "I",
      },
    ]);
  });

  it("aceita código numérico com decimais vindos do banco", () => {
    const { clientes } = parseCorpo("ELO1~25.0|X|||14.0||||||");
    expect(clientes[0].codigo).toBe(25);
  });

  it("ignora registros sem código ou sem nome, e remove código repetido", () => {
    const { clientes, ignorados } = parseCorpo("ELO1~abc|X~5| ~7|B~7|B2~");
    expect(clientes.map((c) => [c.codigo, c.empresa])).toEqual([[7, "B2"]]);
    expect(ignorados).toEqual([
      { posicao: 1, motivo: "código do cliente inválido" },
      { posicao: 2, motivo: "sem nome" },
    ]);
  });

  it("descarta e-mail inválido", () => {
    expect(parseCorpo("ELO1~1|A||J|||||nao-e-email|A").clientes[0].email).toBe("");
  });

  it("recusa corpo sem o cabeçalho de versão", () => {
    expect(() => parseCorpo("10|ACME")).toThrow(/ELO1/);
  });

  it("recusa lote grande demais", () => {
    const corpo = "ELO1~" + Array.from({ length: 1001 }, (_, i) => `${i + 1}|C`).join("~");
    expect(() => parseCorpo(corpo)).toThrow(/1000/);
  });
});
