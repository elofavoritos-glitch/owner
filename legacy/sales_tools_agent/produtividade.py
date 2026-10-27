"""Agentes de produtividade do comercial da ELO.

Reúne três rotinas de uso rápido, todas sobre dados que a ELO já tem:
- agenda_do_dia: o que fazer hoje (Outlook + funil);
- follow_ups_pendentes: propostas/contatos sem resposta que precisam de retomada;
- clientes_para_reativar: carteira parada com potencial de reaproximação.

Não envia nada: apenas prioriza e sugere. Qualquer e-mail passa pelo fluxo de
rascunho + confirmação do especialista Outlook.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional


def _parse_data(value: Any) -> Optional[date]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    texto = str(value).strip().replace("Z", "")
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.strptime(texto[:len(fmt) + 6], fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(texto).date()
    except ValueError:
        return None


def _dias_desde(d: Optional[date], hoje: date) -> Optional[int]:
    return (hoje - d).days if d else None


# ---------------------------------------------------------------------------
# 1) Agenda comercial do dia
# ---------------------------------------------------------------------------
def agenda_do_dia(
    *,
    oportunidades: List[Dict[str, Any]],
    eventos_outlook: Optional[List[Dict[str, Any]]] = None,
    hoje: Optional[date] = None,
) -> Dict[str, Any]:
    hoje = hoje or date.today()
    eventos_outlook = eventos_outlook or []

    acoes_hoje: List[Dict[str, Any]] = []
    acoes_atrasadas: List[Dict[str, Any]] = []
    propostas_vencendo: List[Dict[str, Any]] = []

    for op in oportunidades:
        if str(op.get("status", "")).lower() not in ("ativa", "em espera", ""):
            continue
        data_acao = _parse_data(op.get("data_proxima_acao"))
        item = {
            "id": op.get("id"),
            "cliente": op.get("cliente"),
            "proxima_acao": op.get("proxima_acao") or "(definir próxima ação)",
            "responsavel": op.get("responsavel"),
            "data": data_acao.isoformat() if data_acao else None,
        }
        if data_acao == hoje:
            acoes_hoje.append(item)
        elif data_acao and data_acao < hoje:
            item["dias_atraso"] = (hoje - data_acao).days
            acoes_atrasadas.append(item)

        venc = _parse_data(op.get("validade_proposta"))
        if venc and hoje <= venc <= date.fromordinal(hoje.toordinal() + 3):
            propostas_vencendo.append({
                "id": op.get("id"), "cliente": op.get("cliente"),
                "vence_em": venc.isoformat(), "dias": (venc - hoje).days,
            })

    reunioes = []
    for ev in eventos_outlook:
        reunioes.append({
            "assunto": ev.get("subject", ""),
            "inicio": (ev.get("start") or {}).get("dateTime") if isinstance(ev.get("start"), dict) else ev.get("start"),
        })

    acoes_atrasadas.sort(key=lambda x: x.get("dias_atraso", 0), reverse=True)
    return {
        "data": hoje.isoformat(),
        "reunioes_hoje": reunioes,
        "acoes_para_hoje": acoes_hoje,
        "acoes_atrasadas": acoes_atrasadas,
        "propostas_vencendo": propostas_vencendo,
        "resumo": {
            "reunioes": len(reunioes),
            "acoes_hoje": len(acoes_hoje),
            "atrasadas": len(acoes_atrasadas),
            "propostas_vencendo": len(propostas_vencendo),
        },
    }


# ---------------------------------------------------------------------------
# 2) Follow-up automático (detecção; o envio é sempre rascunho + confirmação)
# ---------------------------------------------------------------------------
@dataclass
class FollowUp:
    id: Any
    cliente: str
    etapa: str
    dias_sem_contato: Optional[int]
    motivo: str
    sugestao: str

    def resumo(self) -> Dict[str, Any]:
        return {
            "id": self.id, "cliente": self.cliente, "etapa": self.etapa,
            "dias_sem_contato": self.dias_sem_contato, "motivo": self.motivo,
            "sugestao_de_acao": self.sugestao,
        }


def follow_ups_pendentes(
    oportunidades: List[Dict[str, Any]],
    *,
    hoje: Optional[date] = None,
    limite_sem_resposta_dias: int = 4,
) -> List[Dict[str, Any]]:
    hoje = hoje or date.today()
    pendentes: List[FollowUp] = []

    for op in oportunidades:
        status = str(op.get("status", "")).lower()
        if status not in ("ativa", "em espera", ""):
            continue
        ultimo = _parse_data(op.get("ultimo_contato"))
        dias = _dias_desde(ultimo, hoje)
        etapa = str(op.get("etapa", "")).strip() or "sem etapa"
        tem_proposta = str(op.get("validade_proposta") or op.get("cotacao_id") or "").strip()

        if tem_proposta and dias is not None and dias >= limite_sem_resposta_dias:
            pendentes.append(FollowUp(
                op.get("id"), op.get("cliente", ""), etapa, dias,
                f"Proposta enviada e sem resposta há {dias} dias.",
                "Enviar follow-up retomando o último assunto e reforçando o prazo.",
            ))
        elif not op.get("proxima_acao") and status in ("ativa", ""):
            pendentes.append(FollowUp(
                op.get("id"), op.get("cliente", ""), etapa, dias,
                "Oportunidade ativa sem próxima ação definida.",
                "Definir e agendar a próxima ação com o cliente.",
            ))

    pendentes.sort(key=lambda f: (f.dias_sem_contato or 0), reverse=True)
    return [f.resumo() for f in pendentes]


# ---------------------------------------------------------------------------
# 3) Reativação de clientes/prospects parados
# ---------------------------------------------------------------------------
def clientes_para_reativar(
    oportunidades: List[Dict[str, Any]],
    *,
    hoje: Optional[date] = None,
    dias_frio: int = 90,
) -> List[Dict[str, Any]]:
    hoje = hoje or date.today()
    reativar: List[Dict[str, Any]] = []

    for op in oportunidades:
        status = str(op.get("status", "")).lower()
        ultimo = _parse_data(op.get("ultimo_contato"))
        dias = _dias_desde(ultimo, hoje)
        etapa = str(op.get("etapa", "")).lower()

        motivo = None
        if status in ("em espera",) and dias is not None and dias >= dias_frio:
            motivo = f"Em espera há {dias} dias."
        elif status == "perdida" and etapa != "ganho":
            motivo = "Oportunidade perdida — avaliar reaproximação após o ciclo."
        elif dias is not None and dias >= dias_frio and status in ("ativa", ""):
            motivo = f"Sem contato há {dias} dias."

        if motivo:
            reativar.append({
                "id": op.get("id"),
                "cliente": op.get("cliente"),
                "etapa": op.get("etapa"),
                "status": op.get("status"),
                "dias_sem_contato": dias,
                "motivo": motivo,
                "sugestao_de_acao": "Contato de reaproximação com oferta de diagnóstico gratuito.",
            })

    reativar.sort(key=lambda x: (x.get("dias_sem_contato") or 0), reverse=True)
    return reativar


if __name__ == "__main__":
    import json
    hoje = date(2026, 10, 12)
    ops = [
        {"id": "OPP-1", "cliente": "Vale Sul", "status": "Ativa", "etapa": "Negociação",
         "ultimo_contato": "2026-10-05", "proxima_acao": "Ligar", "data_proxima_acao": "2026-10-12",
         "validade_proposta": "2026-10-14", "responsavel": "André"},
        {"id": "OPP-2", "cliente": "Indústria XZ", "status": "Ativa", "etapa": "Cotação",
         "ultimo_contato": "2026-10-01", "proxima_acao": "", "data_proxima_acao": "2026-10-08",
         "cotacao_id": "COT-9", "responsavel": "André"},
        {"id": "OPP-3", "cliente": "Antigo Cliente", "status": "Em espera", "etapa": "Diagnóstico",
         "ultimo_contato": "2026-06-01", "responsavel": "André"},
    ]
    print("== AGENDA DO DIA ==")
    print(json.dumps(agenda_do_dia(oportunidades=ops, hoje=hoje), ensure_ascii=False, indent=2))
    print("\n== FOLLOW-UPS ==")
    print(json.dumps(follow_ups_pendentes(ops, hoje=hoje), ensure_ascii=False, indent=2))
    print("\n== REATIVAÇÃO ==")
    print(json.dumps(clientes_para_reativar(ops, hoje=hoje), ensure_ascii=False, indent=2))
