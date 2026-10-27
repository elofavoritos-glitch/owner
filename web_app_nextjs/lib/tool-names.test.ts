import { describe, it, expect } from "vitest";
import { TOOLS } from "./elo-agent";
import { TOOL_NAMES, isToolName } from "./tool-names";

// Protege o alinhamento entre o catálogo de tools (TOOLS, exposto ao LLM) e a
// fonte única de nomes (TOOL_NAMES, usada pelo despacho em route.ts).
// Se as duas listas divergirem (tool adicionada/removida de um lado só), falha.
describe("registro de tools", () => {
  const nomesEmTools = TOOLS.map((t) => t.function.name).sort();
  const nomesCanonicos = [...TOOL_NAMES].sort();

  it("TOOLS e TOOL_NAMES têm exatamente os mesmos nomes", () => {
    expect(nomesEmTools).toEqual(nomesCanonicos);
  });

  it("não há nomes de tool duplicados em TOOLS", () => {
    expect(new Set(nomesEmTools).size).toBe(nomesEmTools.length);
  });

  it("todo nome de TOOLS é reconhecido por isToolName", () => {
    for (const nome of nomesEmTools) {
      expect(isToolName(nome)).toBe(true);
    }
  });

  it("isToolName rejeita nomes desconhecidos", () => {
    expect(isToolName("ferramenta_inexistente")).toBe(false);
    expect(isToolName("")).toBe(false);
  });

  it("inclui calcular_score (capacidade antes prometida no prompt e agora exposta)", () => {
    expect(nomesEmTools).toContain("calcular_score");
  });
});
