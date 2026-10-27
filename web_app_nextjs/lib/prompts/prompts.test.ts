import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "../elo-agent";
import { COMERCIAL_PROMPT } from "./comercial";
import { SENIOR_ERP_PROMPT } from "./senior-erp";

// Protege a composição do SYSTEM_PROMPT depois do fatiamento em módulos.
// Garante que os três blocos (comercial, Senior ERP e identificação da empresa)
// continuam presentes, na ordem certa, sem perda de conteúdo.
describe("SYSTEM_PROMPT (composição dos módulos)", () => {
  it("inclui o bloco comercial e o bloco Senior ERP", () => {
    expect(SYSTEM_PROMPT).toContain(COMERCIAL_PROMPT);
    expect(SYSTEM_PROMPT).toContain(SENIOR_ERP_PROMPT);
  });

  it("mantém o bloco comercial antes do bloco Senior ERP", () => {
    const iComercial = SYSTEM_PROMPT.indexOf("assistente de inteligência e capitalização comercial");
    const iSenior = SYSTEM_PROMPT.indexOf("## Apoio ao Senior Gestão Empresarial | ERP");
    expect(iComercial).toBeGreaterThanOrEqual(0);
    expect(iSenior).toBeGreaterThan(iComercial);
  });

  it("preserva os marcadores-chave de cada capacidade do agente", () => {
    // comercial
    expect(SYSTEM_PROMPT).toContain("## O que você faz");
    expect(SYSTEM_PROMPT).toContain("## Como usar as ferramentas");
    expect(SYSTEM_PROMPT).toContain("## Perfil de cliente ideal (ICP) da ELO");
    // Senior ERP: ERP + LSP + .GER
    expect(SYSTEM_PROMPT).toContain("### Regras / LSP (linguagem de regras do Senior ERP)");
    expect(SYSTEM_PROMPT).toContain("### Gerador de Relatórios e arquivos .GER");
  });

  it("termina com a linha de identificação da empresa (interpolada)", () => {
    expect(SYSTEM_PROMPT.trimEnd().endsWith(").")).toBe(true);
    expect(SYSTEM_PROMPT).toContain("Empresa: ");
  });
});
