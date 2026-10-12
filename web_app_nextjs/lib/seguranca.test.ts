import { describe, it, expect } from "vitest";
import { escaparBusca, validarData, texto } from "./seguranca";

describe("escaparBusca", () => {
  it("remove caracteres perigosos de filtro PostgREST", () => {
    const r = escaparBusca("a,id.eq.123(x)");
    expect(r).not.toContain(",");
    expect(r).not.toContain("(");
    expect(r).not.toContain(")");
  });

  it("neutraliza curingas do LIKE (% e _)", () => {
    const r = escaparBusca("100%_desconto");
    expect(r).not.toContain("%");
    expect(r).not.toContain("_");
  });

  it("preserva texto normal", () => {
    expect(escaparBusca("Transportadora Horizonte")).toBe("Transportadora Horizonte");
  });

  it("respeita o limite de tamanho", () => {
    expect(escaparBusca("x".repeat(200), 50).length).toBeLessThanOrEqual(50);
  });
});

describe("validarData", () => {
  it("aceita AAAA-MM-DD válida", () => {
    expect(validarData("2026-10-12")).toBe("2026-10-12");
  });

  it("rejeita formato inválido", () => {
    expect(validarData("12/10/2026")).toBeNull();
    expect(validarData("hoje")).toBeNull();
    expect(validarData("")).toBeNull();
    expect(validarData(undefined)).toBeNull();
  });

  it("rejeita data impossível", () => {
    expect(validarData("2026-13-99")).toBeNull();
  });
});

describe("texto", () => {
  it("trunca ao limite", () => {
    expect(texto("abcdefgh", 3)).toBe("abc");
  });

  it("retorna null para vazio", () => {
    expect(texto("   ")).toBeNull();
    expect(texto(undefined)).toBeNull();
  });

  it("faz trim", () => {
    expect(texto("  oi  ")).toBe("oi");
  });
});
