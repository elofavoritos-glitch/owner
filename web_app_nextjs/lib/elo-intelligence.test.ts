import { describe, it, expect } from "vitest";
import {
  calcularScore, analisarDiagnostico, montarDossie, classificarRelacionamento,
  PESOS_SCORE,
} from "./elo-intelligence";

describe("calcularScore", () => {
  it("sem evidências → score 0, prioridade Baixa, tudo pendente", () => {
    const r = calcularScore("Empresa X", {});
    expect(r.score).toBe(0);
    expect(r.prioridade).toBe("Baixa");
    expect(r.pendencias).toHaveLength(Object.keys(PESOS_SCORE).length);
  });

  it("soma peso × nota corretamente", () => {
    const r = calcularScore("Empresa X", {
      aderencia_icp: { nota: 1 },        // 30
      potencial_servicos_elo: { nota: 1 }, // 30
      regiao_rotas: { nota: 1 },         // 15
    });
    expect(r.score).toBe(75);
    expect(r.prioridade).toBe("Alta"); // >= 70
  });

  it("faixas de prioridade (Média entre 45 e 69)", () => {
    const r = calcularScore("X", {
      aderencia_icp: { nota: 1 },         // 30
      potencial_servicos_elo: { nota: 0.5 }, // 15
    });
    expect(r.score).toBe(45);
    expect(r.prioridade).toBe("Média");
  });

  it("rejeita nota fora de 0..1", () => {
    expect(() => calcularScore("X", { aderencia_icp: { nota: 5 } })).toThrow();
    expect(() => calcularScore("X", { aderencia_icp: { nota: -1 } })).toThrow();
  });

  it("exige nome da empresa", () => {
    expect(() => calcularScore("", {})).toThrow();
  });

  it("recomenda solução integrada quando há armazenagem + transporte", () => {
    const r = calcularScore("X", {
      potencial_servicos_elo: { nota: 1, servicos: ["armazenagem", "transporte"] },
    });
    expect(r.servicos_recomendados).toContain("Armazenagem");
    expect(r.servicos_recomendados).toContain("Transporte rodoviário");
    expect(r.servicos_recomendados).toContain("Solução integrada (armazenagem + transporte)");
  });
});

describe("analisarDiagnostico", () => {
  it("só armazenagem → recomenda apenas armazenagem", () => {
    const d = analisarDiagnostico({ precisa_armazenagem: "sim", precisa_transporte: "não" });
    expect(d.servicos_recomendados).toEqual(["Armazenagem"]);
    expect(d.evidencias.potencial_servicos_elo.nota).toBe(0.6);
  });

  it("ambos → potencial nota 1 e solução integrada", () => {
    const d = analisarDiagnostico({ precisa_armazenagem: "sim", precisa_transporte: "sim" });
    expect(d.servicos_recomendados).toContain("Solução integrada (armazenagem + transporte)");
    expect(d.evidencias.potencial_servicos_elo.nota).toBe(1);
  });

  it("importação gera evidência de atividade logística alta", () => {
    const d = analisarDiagnostico({ importacao: "sim" });
    expect(d.evidencias.atividade_logistica.nota).toBe(1);
  });

  it("origem/destino no Sul gera evidência de região", () => {
    const d = analisarDiagnostico({ origem: "Itajaí/SC", destino: "Paraná" });
    expect(d.evidencias.regiao_rotas).toBeDefined();
  });

  it("lista pendências para campos não informados", () => {
    const d = analisarDiagnostico({ produto: "aço" });
    expect(d.pendencias.length).toBeGreaterThan(0);
  });
});

describe("montarDossie", () => {
  it("empresa forte (armazenagem+transporte+importação+SC) tem score coerente", () => {
    const d = montarDossie("MetalForte", {
      respostas_diagnostico: {
        precisa_armazenagem: "sim", precisa_transporte: "sim",
        importacao: "sim", origem: "Itajaí/SC", destino: "Paraná",
      },
    });
    // potencial(30) + atividade(5) + regiao(0.8*15=12) = 47
    expect(d.score.score).toBe(47);
    expect(d.servicos_recomendados).toContain("Solução integrada (armazenagem + transporte)");
    expect(d.proxima_melhor_acao).toMatch(/abordagem/i);
  });

  it("empresa sem dados → próxima ação de primeira abordagem", () => {
    const d = montarDossie("Desconhecida", {});
    expect(d.score.score).toBe(0);
    expect(d.proxima_melhor_acao).toMatch(/primeira abordagem/i);
  });

  it("exige nome da empresa", () => {
    expect(() => montarDossie("", {})).toThrow();
  });
});

describe("classificarRelacionamento", () => {
  const hoje = new Date().toISOString().slice(0, 10);
  const antigo = new Date(Date.now() - 150 * 86400000).toISOString().slice(0, 10);

  it("sem interações → nunca abordada", () => {
    const r = classificarRelacionamento("X", []);
    expect(r.estagio).toBe("Empresa nunca abordada por esta conta");
  });

  it("só enviados → contatado sem resposta", () => {
    const r = classificarRelacionamento("X", [
      { canal: "email", direcao: "enviado", data_interacao: hoje },
    ]);
    expect(r.estagio).toBe("Prospect contatado sem resposta");
  });

  it("resposta recente → ativo", () => {
    const r = classificarRelacionamento("X", [
      { canal: "email", direcao: "enviado", data_interacao: hoje },
      { canal: "ligacao", direcao: "recebido", data_interacao: hoje },
    ]);
    expect(r.estagio).toBe("Relacionamento ativo");
    expect(r.houve_resposta_cliente).toBe(true);
  });

  it("resposta antiga (>120 dias) → esfriado", () => {
    const r = classificarRelacionamento("X", [
      { canal: "email", direcao: "recebido", data_interacao: antigo },
    ]);
    expect(r.estagio).toBe("Relacionamento esfriado (reativar)");
  });

  it("dias nunca é negativo", () => {
    const futuro = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const r = classificarRelacionamento("X", [
      { canal: "email", direcao: "recebido", data_interacao: futuro },
    ]);
    expect(r.dias_sem_contato).toBeGreaterThanOrEqual(0);
  });
});
