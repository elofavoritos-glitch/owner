"""Fecha o ciclo: dossiê → proposta PDF → rascunho no Outlook.

Cria um rascunho na conta do próprio comercial com a proposta anexada e PARA na
etapa de confirmação. O envio nunca é automático: exige confirmação humana
explícita, conforme a política do especialista Outlook.
"""
from __future__ import annotations

import html
from pathlib import Path
from typing import Any, Dict, List, Optional

from proposta_do_dossie import proposta_pdf_do_dossie


def _corpo_html(empresa: str, contato: str, servicos: List[str], responsavel: str) -> str:
    saudacao = f"Prezado(a) {html.escape(contato)}," if contato else "Prezados,"
    itens = "".join(f"<li>{html.escape(s)}</li>" for s in servicos)
    return (
        f"<p>{saudacao}</p>"
        f"<p>Agradecemos o contato. Conforme conversamos, segue em anexo a proposta "
        f"da <strong>ELO Soluções Logísticas Integradas</strong> para "
        f"{html.escape(empresa)}, contemplando:</p>"
        f"<ul>{itens}</ul>"
        f"<p>Permanecemos à disposição para apresentar a proposta e ajustar o escopo "
        f"à realidade operacional da sua empresa.</p>"
        f"<p>Atenciosamente,<br>{html.escape(responsavel or 'Equipe Comercial ELO')}<br>"
        f"ELO Soluções Logísticas Integradas</p>"
    )


def preparar_rascunho_proposta(
    mail_service: Any,
    user_id: str,
    dossie: Dict[str, Any],
    *,
    destinatarios: List[str],
    contato: str = "",
    numero: str = "",
    validade: str = "",
    responsavel: str = "",
    itens: Optional[List[Dict[str, Any]]] = None,
    cc: Optional[List[str]] = None,
) -> Dict[str, Any]:
    if not destinatarios:
        raise ValueError("Informe ao menos um destinatário para o rascunho.")

    empresa = str(dossie.get("empresa", "")).strip()

    # 1) Gera a proposta PDF a partir do dossiê.
    proposta = proposta_pdf_do_dossie(
        dossie,
        itens=itens,
        cliente_extra={"contato": contato} if contato else None,
        numero=numero,
        validade=validade,
        responsavel=responsavel,
    )
    pdf_path = proposta["arquivo"]
    if not Path(pdf_path).is_file():
        raise RuntimeError("A proposta PDF não foi gerada corretamente.")

    servicos = proposta["servicos"]
    assunto = f"Proposta ELO — {empresa}" if empresa else "Proposta ELO"
    corpo = _corpo_html(empresa, contato, servicos, responsavel)

    # 2) Cria o rascunho na conta do comercial, com o PDF anexado.
    #    create_draft retorna a prévia e já sinaliza confirmation_required=True.
    rascunho = mail_service.create_draft(
        user_id,
        to=destinatarios,
        subject=assunto,
        body_html=corpo,
        cc=cc,
        attachments=[pdf_path],
    )

    return {
        "status": rascunho.get("status", "draft"),
        "confirmation_required": True,
        "draft_id": rascunho.get("draft_id"),
        "proposta_pdf": pdf_path,
        "empresa": empresa,
        "servicos": servicos,
        "score": proposta.get("score"),
        "prioridade": proposta.get("prioridade"),
        "pendencias": proposta.get("pendencias", []),
        "preview": rascunho.get("preview"),
        "proximo_passo": (
            "Revise a prévia. Para enviar, use request_send_confirmation e, só "
            "após a confirmação humana, send_confirmed. O envio nunca é automático."
        ),
    }
