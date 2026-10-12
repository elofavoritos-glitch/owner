import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { lerPlanilha, mapearColunas, montarRegistros } from "./planilha";

// Gera um buffer xlsx a partir de uma matriz (cabeçalho + linhas).
function xlsxBuffer(matriz: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(matriz);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plan1");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out as ArrayBuffer;
}

describe("mapearColunas", () => {
  it("reconhece sinônimos de colunas de clientes", () => {
    const mapa = mapearColunas(["Razao Social", "CNPJ", "Cidade", "UF"], "clientes");
    expect(mapa["Razao Social"]).toBe("empresa");
    expect(mapa["CNPJ"]).toBe("cnpj");
    expect(mapa["Cidade"]).toBe("cidade");
    expect(mapa["UF"]).toBe("uf");
  });

  it("ignora colunas desconhecidas (null)", () => {
    const mapa = mapearColunas(["ColunaEstranha"], "clientes");
    expect(mapa["ColunaEstranha"]).toBeNull();
  });

  it("mapeia colunas de oportunidades", () => {
    const mapa = mapearColunas(["Cliente", "Valor", "Etapa"], "oportunidades");
    expect(mapa["Cliente"]).toBe("cliente_nome");
    expect(mapa["Valor"]).toBe("valor_potencial");
    expect(mapa["Etapa"]).toBe("etapa");
  });
});

describe("montarRegistros - conversão de valores", () => {
  it("valor BR 150.000,00 vira 150000 (regressão do bug)", () => {
    const p = lerPlanilha(xlsxBuffer([
      ["Cliente", "Valor", "Probabilidade"],
      ["Alfa", "150.000,00", "60"],
    ]));
    const mapa = mapearColunas(p.cabecalhos, "oportunidades");
    const { registros } = montarRegistros(p, "oportunidades", mapa);
    expect(registros[0].valor_potencial).toBe(150000);
    expect(registros[0].probabilidade).toBe(0.6);
  });

  it("probabilidade fracionada (0,5) é respeitada", () => {
    const p = lerPlanilha(xlsxBuffer([
      ["Cliente", "Probabilidade"],
      ["Beta", "0,5"],
    ]));
    const mapa = mapearColunas(p.cabecalhos, "oportunidades");
    const { registros } = montarRegistros(p, "oportunidades", mapa);
    expect(registros[0].probabilidade).toBe(0.5);
  });

  it("milhar sem vírgula 1.234.567 não perde valor", () => {
    const p = lerPlanilha(xlsxBuffer([
      ["Cliente", "Valor"],
      ["Gama", "1.234.567"],
    ]));
    const mapa = mapearColunas(p.cabecalhos, "oportunidades");
    const { registros } = montarRegistros(p, "oportunidades", mapa);
    expect(registros[0].valor_potencial).toBe(1234567);
  });
});

describe("montarRegistros - linhas inválidas", () => {
  it("ignora linha sem o campo obrigatório (empresa)", () => {
    const p = lerPlanilha(xlsxBuffer([
      ["Razao Social", "CNPJ"],
      ["Alfa", "111"],
      ["", "222"], // sem empresa → ignorada
    ]));
    const mapa = mapearColunas(p.cabecalhos, "clientes");
    const { registros, ignoradas } = montarRegistros(p, "clientes", mapa);
    expect(registros).toHaveLength(1);
    expect(ignoradas).toBe(1);
  });

  it("normaliza etapa inválida (remove, deixando o default do banco)", () => {
    const p = lerPlanilha(xlsxBuffer([
      ["Cliente", "Etapa"],
      ["Alfa", "EtapaInexistente"],
    ]));
    const mapa = mapearColunas(p.cabecalhos, "oportunidades");
    const { registros } = montarRegistros(p, "oportunidades", mapa);
    expect(registros[0].etapa).toBeUndefined();
  });
});

describe("lerPlanilha - cabeçalhos", () => {
  it("desduplica cabeçalhos repetidos", () => {
    const p = lerPlanilha(xlsxBuffer([
      ["Cliente", "Cliente"],
      ["a", "b"],
    ]));
    expect(p.cabecalhos[0]).toBe("Cliente");
    expect(p.cabecalhos[1]).not.toBe("Cliente"); // renomeado
    expect(p.linhas[0]["Cliente"]).toBe("a"); // não sobrescrito
  });
});
