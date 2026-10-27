"""Demonstração offline do agente de capitalização comercial da ELO."""
from __future__ import annotations

import json

from dossie import montar_dossie
from relacionamento import Relacionamento


def exemplo() -> dict:
    # Relacionamento simulado (em produção vem do Outlook do próprio usuário).
    relacionamento = Relacionamento(
        termo="Importadora Maré Alta",
        estagio="Relacionamento ativo",
        total_mensagens=4,
        ultimo_contato="2026-10-05",
        dias_sem_contato=6,
        responsaveis=["andre.galao@elo.log.br"],
        assuntos_recentes=["Cotação de armazenagem", "Visita técnica"],
        houve_resposta_cliente=True,
    )
    respostas = {
        "produto": "Bens de consumo importados",
        "volume_medio": "30 pallets/mês",
        "volume_pico": "50 pallets em dezembro",
        "origem": "Porto de Itajaí/SC",
        "destino": "Região Sul",
        "frequencia": "3 embarques/semana",
        "precisa_armazenagem": "sim",
        "precisa_transporte": "sim",
        "importacao": "sim",
        "sla": "48h após liberação",
        "fornecedor_atual": "Operador atual com atrasos recorrentes",
        "decisor": "Gerente de logística",
        "prazo_inicio": "Próximo trimestre",
    }
    return montar_dossie(
        "Importadora Maré Alta",
        respostas_diagnostico=respostas,
        relacionamento=relacionamento,
        evidencias_extras={
            "aderencia_icp": {"nota": 0.9, "justificativa": "Importadora na região Sul.", "fonte": "comercial"},
            "sinal_recente": {"nota": 0.7, "justificativa": "Insatisfação com operador atual.", "fonte": "diagnóstico guiado"},
        },
    )


if __name__ == "__main__":
    print(json.dumps(exemplo(), ensure_ascii=False, indent=2))
