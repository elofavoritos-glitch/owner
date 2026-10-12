"""Gera ata de reunião comercial estruturada a partir de anotações.

Organiza anotações livres em ata (participantes, pauta, decisões, próximos
passos) e extrai a próxima ação. Opcionalmente exporta em PDF reutilizando o
motor do pdf_agent. Não inventa conteúdo: só estrutura o que foi informado.
"""
from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pdf_agent"))


def _linhas(texto: str) -> List[str]:
    return [l.strip(" -•\t") for l in str(texto).splitlines() if l.strip()]


def montar_ata(dados: Dict[str, Any]) -> Dict[str, Any]:
    """dados: {empresa, data, participantes:[...], anotacoes: str, decisoes:[...], proximos_passos:[...]}."""
    empresa = str(dados.get("empresa", "")).strip()
    if not empresa:
        raise ValueError("Informe a empresa/cliente da reunião.")

    participantes = [p for p in dados.get("participantes", []) if str(p).strip()]
    anotacoes = _linhas(dados.get("anotacoes", ""))
    decisoes = [d for d in dados.get("decisoes", []) if str(d).strip()] or _detectar(anotacoes, ("decid", "fechad", "acordad", "aprovad"))
    proximos = [p for p in dados.get("proximos_passos", []) if str(p).strip()] or _detectar(anotacoes, ("enviar", "agendar", "retornar", "preparar", "cotar", "ligar", "mandar"))

    pendencias = []
    if not participantes:
        pendencias.append("participantes")
    if not anotacoes:
        pendencias.append("anotações da reunião")

    proxima_acao = proximos[0] if proximos else "(definir próxima ação com o cliente)"

    return {
        "empresa": empresa,
        "data": str(dados.get("data") or date.today().strftime("%d/%m/%Y")),
        "participantes": participantes,
        "pauta_discutida": anotacoes,
        "decisoes": decisoes,
        "proximos_passos": proximos,
        "proxima_acao": proxima_acao,
        "pendencias": pendencias,
    }


def _detectar(linhas: List[str], gatilhos) -> List[str]:
    return [l for l in linhas if any(g in l.lower() for g in gatilhos)]


def exportar_pdf(ata: Dict[str, Any], saida: Optional[str] = None) -> str:
    from pdf_writer import PDFDocument, validate_pdf  # type: ignore

    pdf = PDFDocument("Ata de Reunião")
    pdf.add_title("ATA DE REUNIÃO")
    pdf.add_key_value("Cliente", ata["empresa"])
    pdf.add_key_value("Data", ata["data"])
    pdf.add_heading("Participantes")
    pdf.add_bullets(ata["participantes"] or ["(não informado)"])
    pdf.add_heading("Pauta discutida")
    pdf.add_bullets(ata["pauta_discutida"] or ["(não informado)"])
    pdf.add_heading("Decisões")
    pdf.add_bullets(ata["decisoes"] or ["(sem decisões registradas)"])
    pdf.add_heading("Próximos passos")
    pdf.add_bullets(ata["proximos_passos"] or ["(definir)"])
    pdf.add_heading("Próxima ação")
    pdf.add_paragraph(ata["proxima_acao"], bold=True)

    if saida is None:
        slug = (re.sub(r"[^a-zA-Z0-9_-]+", "_", ata["empresa"]).strip("_") or "cliente").lower()
        saida = str(Path(__file__).resolve().parent.parent / "pdf_agent" / "output" / f"ata_elo_{slug}_{date.today().isoformat()}.pdf")
    caminho = pdf.save(saida)
    validate_pdf(caminho)
    return caminho


if __name__ == "__main__":
    import json
    dados = {
        "empresa": "Transportadora Vale Sul",
        "participantes": ["André Galão (ELO)", "Carlos (Vale Sul)"],
        "anotacoes": (
            "Cliente precisa de espaço no pico de dezembro.\n"
            "Decidido fazer um piloto de armazenagem em novembro.\n"
            "Enviar proposta de armazenagem + transporte até sexta.\n"
            "Agendar visita ao CD na próxima semana."
        ),
    }
    ata = montar_ata(dados)
    print(json.dumps(ata, ensure_ascii=False, indent=2))
    caminho = exportar_pdf(ata)
    print("PDF da ata:", caminho)
