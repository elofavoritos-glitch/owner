"""Capacidade de armazém da ELO: "temos espaço para esse cliente?".

Cruza a demanda de posições-pallet do prospect com a capacidade e a ocupação
atual do CD. Não inventa capacidade: se a ocupação não for informada, retorna
status 'sem_dados_cd' e orienta cadastrar a capacidade real.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class ResultadoCapacidade:
    status: str
    livre_atual: Optional[int]
    demanda: Optional[int]
    cabe: Optional[bool]
    ocupacao_apos_percent: Optional[float]
    mensagem: str
    recomendacao: str

    def resumo(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "posicoes_livres_atuais": self.livre_atual,
            "demanda_posicoes": self.demanda,
            "cabe": self.cabe,
            "ocupacao_apos_percent": self.ocupacao_apos_percent,
            "mensagem": self.mensagem,
            "recomendacao": self.recomendacao,
        }


def avaliar(
    *,
    capacidade_total: Optional[int],
    ocupadas: Optional[int],
    demanda_posicoes: Optional[int],
    margem_seguranca_percent: float = 10.0,
) -> Dict[str, Any]:
    """capacidade_total/ocupadas: posições-pallet do CD. demanda_posicoes: do cliente."""
    if capacidade_total is None or ocupadas is None:
        return ResultadoCapacidade(
            "sem_dados_cd", None, demanda_posicoes, None, None,
            "Capacidade/ocupação do CD não informadas.",
            "Cadastre a capacidade total e a ocupação atual para avaliar o encaixe.",
        ).resumo()
    if capacidade_total <= 0:
        raise ValueError("capacidade_total deve ser maior que zero.")
    if ocupadas < 0 or ocupadas > capacidade_total:
        raise ValueError("ocupadas deve estar entre 0 e a capacidade total.")

    livre = capacidade_total - ocupadas
    # Reserva de segurança para não lotar 100% do CD.
    reserva = round(capacidade_total * margem_seguranca_percent / 100)
    livre_util = max(0, livre - reserva)

    if demanda_posicoes is None:
        return ResultadoCapacidade(
            "sem_demanda", livre_util, None, None, round(ocupadas / capacidade_total * 100, 1),
            f"CD com {livre_util} posições úteis livres (após reserva de {margem_seguranca_percent:.0f}%).",
            "Informe a demanda do cliente (posições-pallet) para checar o encaixe.",
        ).resumo()

    cabe = demanda_posicoes <= livre_util
    ocup_apos = round((ocupadas + demanda_posicoes) / capacidade_total * 100, 1)

    if cabe:
        msg = f"Cabe: demanda de {demanda_posicoes} em {livre_util} posições úteis livres."
        rec = "Pode avançar com a proposta de armazenagem. Confirmar período e giro."
    else:
        falta = demanda_posicoes - livre_util
        msg = f"Não cabe integralmente: faltam ~{falta} posições (livres úteis: {livre_util})."
        rec = "Avaliar atendimento parcial, remanejamento, expansão ou janela futura antes de prometer."

    return ResultadoCapacidade(
        "ok", livre_util, demanda_posicoes, cabe, ocup_apos, msg, rec
    ).resumo()


if __name__ == "__main__":
    import json
    casos = [
        {"capacidade_total": 1000, "ocupadas": 700, "demanda_posicoes": 150},
        {"capacidade_total": 1000, "ocupadas": 900, "demanda_posicoes": 150},
        {"capacidade_total": None, "ocupadas": None, "demanda_posicoes": 150},
        {"capacidade_total": 1000, "ocupadas": 500, "demanda_posicoes": None},
    ]
    for c in casos:
        print("Entrada:", c)
        print(json.dumps(avaliar(**c), ensure_ascii=False, indent=2))
        print("-" * 40)
