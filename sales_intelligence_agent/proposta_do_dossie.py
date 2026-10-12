"""Converte um dossiê de inteligência comercial em proposta PDF da ELO.

Reutiliza o gerador oficial em /projects/sandbox/pdf_agent. Não inventa preços:
itens sem valor confirmado entram com valor_unit=0 e aparecem como pendência,
preservando a regra de nunca presumir dados comerciais.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Permite importar o gerador PDF oficial sem duplicar código.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pdf_agent"))

from gerar_proposta_pdf import gerar_proposta_pdf  # type: ignore


ESCOPO_POR_SERVICO = {
    "Armazenagem": "Armazenagem de carga com controle de estoque e movimentação.",
    "Transporte rodoviário": "Transporte rodoviário dedicado na área de atuação da ELO.",
    "Solução integrada (armazenagem + transporte)": "Solução integrada de armazenagem e distribuição ponta a ponta.",
}


def proposta_pdf_do_dossie(
    dossie: Dict[str, Any],
    *,
    itens: Optional[List[Dict[str, Any]]] = None,
    cliente_extra: Optional[Dict[str, Any]] = None,
    numero: str = "",
    validade: str = "",
    responsavel: str = "",
    saida: Optional[str] = None,
) -> Dict[str, Any]:
    empresa = str(dossie.get("empresa", "")).strip()
    if not empresa:
        raise ValueError("O dossiê precisa conter a empresa.")

    servicos = dossie.get("servicos_recomendados") or []
    if not servicos:
        raise ValueError("O dossiê não tem serviços recomendados; conclua o diagnóstico antes.")

    escopo = [ESCOPO_POR_SERVICO.get(s, s) for s in servicos]

    # Itens: usam valores informados; sem valor confirmado, entram como pendência.
    pendencias: List[str] = []
    if itens:
        itens_proposta = itens
    else:
        itens_proposta = []
        for servico in servicos:
            if servico.startswith("Solução integrada"):
                continue
            itens_proposta.append({
                "descricao": servico,
                "qtd": 1,
                "valor_unit": 0,
            })
            pendencias.append(f"Valor de '{servico}'")

    cliente = {"empresa": empresa}
    if cliente_extra:
        cliente.update(cliente_extra)

    diagnostico = dossie.get("diagnostico", {}) or {}
    respostas = diagnostico.get("respostas", {}) if isinstance(diagnostico, dict) else {}
    apresentacao = (
        f"Com base no diagnóstico logístico realizado, a ELO Soluções Logísticas "
        f"Integradas apresenta a {empresa} uma proposta personalizada para "
        f"{', '.join(servicos).lower()}."
    )

    condicoes = [
        "Valores sujeitos à validação final das premissas operacionais.",
        "Prazos e SLA conforme aceite comercial.",
    ]
    if respostas.get("sla"):
        condicoes.append(f"SLA informado no diagnóstico: {respostas['sla']}.")

    dados = {
        "numero": numero,
        "validade": validade,
        "responsavel": responsavel,
        "cliente": cliente,
        "apresentacao": apresentacao,
        "servicos": escopo,
        "itens": itens_proposta,
        "condicoes": condicoes,
    }

    caminho = gerar_proposta_pdf(dados, saida)
    return {
        "arquivo": caminho,
        "empresa": empresa,
        "servicos": servicos,
        "pendencias": pendencias,
        "score": dossie.get("score", {}).get("score"),
        "prioridade": dossie.get("score", {}).get("prioridade"),
    }


if __name__ == "__main__":
    from dossie import montar_dossie
    from relacionamento import Relacionamento

    rel = Relacionamento(
        "Transportadora Vale Sul", "Relacionamento ativo", 5, "2026-10-07", 5,
        ["andre.galao@elo.log.br"], ["Cotação de armazenagem"], True,
    )
    dossie = montar_dossie(
        "Transportadora Vale Sul",
        respostas_diagnostico={
            "produto": "Bebidas", "volume_medio": "40 pallets/mês", "volume_pico": "70 em dezembro",
            "origem": "Itajaí/SC", "destino": "Curitiba/PR", "frequencia": "4 embarques/semana",
            "precisa_armazenagem": "sim", "precisa_transporte": "sim", "importacao": "nao",
            "sla": "24h", "fornecedor_atual": "Sem operador fixo", "decisor": "Diretor", "prazo_inicio": "30 dias",
        },
        relacionamento=rel,
        evidencias_extras={
            "aderencia_icp": {"nota": 0.85, "justificativa": "Distribuição regional.", "fonte": "comercial"},
            "sinal_recente": {"nota": 0.8, "justificativa": "Pico sazonal próximo.", "fonte": "diagnóstico"},
        },
    )

    resultado = proposta_pdf_do_dossie(
        dossie,
        itens=[
            {"descricao": "Armazenagem (pallet/mês)", "qtd": 40, "valor_unit": 42.50},
            {"descricao": "Transporte rodoviário dedicado (viagem)", "qtd": 8, "valor_unit": 980},
        ],
        numero="PROP-2026-001",
        validade="15 dias",
        responsavel="Equipe Comercial ELO",
    )
    print("Proposta PDF gerada a partir do dossiê:")
    for chave, valor in resultado.items():
        print(f"  {chave}: {valor}")
