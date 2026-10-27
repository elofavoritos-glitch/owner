"""Minerador de relacionamento interno a partir do Outlook já conectado.

Responde "já falamos com essa empresa?" usando apenas a caixa do usuário
autenticado (/me). Classifica o estágio do relacionamento com base em sinais
objetivos. Não acessa caixas de terceiros nem presume dados.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@dataclass
class Relacionamento:
    termo: str
    estagio: str
    total_mensagens: int
    ultimo_contato: Optional[str]
    dias_sem_contato: Optional[int]
    responsaveis: List[str] = field(default_factory=list)
    assuntos_recentes: List[str] = field(default_factory=list)
    houve_resposta_cliente: bool = False

    def resumo(self) -> Dict[str, Any]:
        return {
            "termo_pesquisado": self.termo,
            "estagio": self.estagio,
            "total_mensagens": self.total_mensagens,
            "ultimo_contato": self.ultimo_contato,
            "dias_sem_contato": self.dias_sem_contato,
            "responsaveis": self.responsaveis,
            "assuntos_recentes": self.assuntos_recentes,
            "houve_resposta_do_cliente": self.houve_resposta_cliente,
        }


class RelacionamentoService:
    """Depende de um mail_service com search_messages(user_id, texto, limit)."""

    def __init__(self, mail_service: Any) -> None:
        self.mail = mail_service

    def investigar(self, user_id: str, termo: str, *, dominio: str = "", limit: int = 100) -> Relacionamento:
        termo = str(termo).strip()
        if not termo:
            raise ValueError("Informe empresa, CNPJ, domínio ou e-mail para pesquisar.")

        mensagens = self.mail.search_messages(user_id, dominio or termo, limit=limit)

        usuario = (user_id or "").lower()
        datas: List[datetime] = []
        responsaveis: set[str] = set()
        assuntos: List[str] = []
        resposta_cliente = False

        for msg in mensagens:
            remetente = ((msg.get("from") or {}).get("emailAddress") or {}).get("address", "").lower()
            dt = _parse_dt(msg.get("receivedDateTime") or msg.get("sentDateTime"))
            if dt:
                datas.append(dt)
            assunto = str(msg.get("subject", "")).strip()
            if assunto and assunto not in assuntos:
                assuntos.append(assunto)
            if remetente and remetente != usuario and (not dominio or dominio.lower() in remetente):
                resposta_cliente = True
                responsaveis.add("cliente")
            elif remetente:
                responsaveis.add(remetente)

        total = len(mensagens)
        ultimo = max(datas) if datas else None
        dias = (datetime.now(timezone.utc) - ultimo).days if ultimo else None

        estagio = self._classificar(total, resposta_cliente, dias)
        return Relacionamento(
            termo=termo,
            estagio=estagio,
            total_mensagens=total,
            ultimo_contato=ultimo.date().isoformat() if ultimo else None,
            dias_sem_contato=dias,
            responsaveis=sorted(r for r in responsaveis if r != "cliente"),
            assuntos_recentes=assuntos[:5],
            houve_resposta_cliente=resposta_cliente,
        )

    @staticmethod
    def _classificar(total: int, resposta_cliente: bool, dias: Optional[int]) -> str:
        if total == 0:
            return "Empresa nunca abordada por esta conta"
        if not resposta_cliente:
            return "Prospect contatado sem resposta"
        if dias is not None and dias > 120:
            return "Relacionamento esfriado (reativar)"
        return "Relacionamento ativo"

    def evidencia_score(self, relacionamento: Relacionamento) -> Dict[str, Any]:
        """Converte o relacionamento em evidência para o critério de score."""
        if relacionamento.total_mensagens == 0:
            return {}
        nota = 0.6
        if relacionamento.houve_resposta_cliente:
            nota = 0.9
        if relacionamento.dias_sem_contato is not None and relacionamento.dias_sem_contato > 120:
            nota = 0.5
        return {
            "relacionamento_anterior": {
                "nota": nota,
                "justificativa": f"{relacionamento.total_mensagens} mensagem(ns); estágio: {relacionamento.estagio}.",
                "fonte": "Outlook (conta do usuário)",
            }
        }
