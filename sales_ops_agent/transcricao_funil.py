"""Transcrição de notas comerciais em dados estruturados para o funil da ELO.

Recebe texto livre (anotações de ligação/reunião) e extrai campos úteis
(volume, serviço, origem/destino, decisor, prazo, dor, próxima ação) por meio de
padrões simples e explícitos. O que não for encontrado fica vazio e é listado
como pendência — nunca é presumido.

A saída segue o formato de oportunidade usado pelo funil (gerar_funil), para
facilitar o cadastro — sempre sujeito à confirmação do comercial.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List, Optional


def _norm(texto: str) -> str:
    return unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode().lower()


def _buscar(padroes: List[str], texto: str) -> Optional[str]:
    for p in padroes:
        m = re.search(p, texto, flags=re.IGNORECASE)
        if m:
            return m.group(1).strip(" .,;:")
    return None


def extrair(texto: str, *, empresa: str = "", responsavel: str = "") -> Dict[str, Any]:
    if not str(texto).strip():
        raise ValueError("Informe o texto das anotações para transcrever.")
    bruto = str(texto)
    norm = _norm(bruto)

    # Volume (pallets, toneladas, contêineres, m3).
    volume = _buscar([
        r"(\d[\d\.\,]*\s*(?:pallets?|paletes?))",
        r"(\d[\d\.\,]*\s*(?:toneladas?|ton|t)\b)",
        r"(\d[\d\.\,]*\s*(?:conteiner(?:es)?|containers?))",
        r"(\d[\d\.\,]*\s*m3)",
    ], norm)

    # Serviço de interesse.
    servicos = []
    if "armazenag" in norm:
        servicos.append("Armazenagem")
    if "transporte" in norm or "frete" in norm or "distribu" in norm:
        servicos.append("Transporte rodoviário")

    # Origem/destino.
    # Cidade/UF (ex.: Itajaí/SC). \w com re.UNICODE cobre acentos.
    cidade_uf = r"([^\s,.;]+/[A-Z]{2})"
    origem = _buscar([r"origem[:\s]+" + cidade_uf, r"\bde\s+" + cidade_uf], bruto)
    destino = _buscar([r"destino[:\s]+" + cidade_uf, r"\bpara\s+" + cidade_uf], bruto)

    # Decisor.
    # Primeiro tenta cargos conhecidos; depois rótulos explícitos. Evita capturar "é o".
    decisor = _buscar([
        r"(gerente de log[ií]stica|diretor[a]? comercial|diretor[a]? de log[ií]stica|supervisor[a]? de log[ií]stica|comprador[a]?|s[oó]cio[a]?|propriet[aá]rio[a]?)",
        r"decisor[:\s]+([a-zà-ÿ ]+?)(?:[,.;\n]|$)",
        r"quem decide[:\s]+(?:e\s+o\s+|e\s+a\s+)?([a-zà-ÿ ]+?)(?:[,.;\n]|$)",
    ], bruto)

    # Prazo / urgência.
    prazo = _buscar([
        r"(in[ií]cio em [a-z0-9 ]+)",
        r"(pr[oó]ximo trimestre)",
        r"(em \d+ dias)",
        r"(at[eé] [a-z]+)",
        r"prazo[:\s]+([a-z0-9 ]+?)(?:[,.;\n]|$)",
    ], norm)

    # Dor / problema.
    dor = _buscar([
        r"(falta de espa[cç]o[a-z ]*)",
        r"(atraso[s]?[a-z ]*)",
        r"(custo alto[a-z ]*)",
        r"(avaria[s]?[a-z ]*)",
        r"(ruptura[s]?[a-z ]*)",
        r"problema[:\s]+([a-z0-9 ]+?)(?:[,.;\n]|$)",
    ], norm)

    # Próxima ação.
    proxima = _buscar([
        r"(enviar [a-z0-9 ]+?)(?:[,.;\n]|$)",
        r"(agendar [a-z0-9 ]+?)(?:[,.;\n]|$)",
        r"(retornar [a-z0-9 ]+?)(?:[,.;\n]|$)",
        r"(preparar [a-z0-9 ]+?)(?:[,.;\n]|$)",
        r"(ligar [a-z0-9 ]+?)(?:[,.;\n]|$)",
    ], norm)

    oportunidade = {
        "cliente": empresa.strip(),
        "responsavel": responsavel.strip(),
        "servico": " + ".join(servicos),
        "rota": " -> ".join([x for x in (origem, destino) if x]) if (origem or destino) else "",
        "proxima_acao": proxima or "",
        "etapa": "Qualificação",
        "status": "Ativa",
    }

    campos_extraidos = {
        "volume": volume or "",
        "servico_interesse": servicos,
        "origem": origem or "",
        "destino": destino or "",
        "decisor": decisor or "",
        "prazo": prazo or "",
        "dor": dor or "",
        "proxima_acao": proxima or "",
    }

    pendencias = [k for k, v in {
        "empresa/cliente": empresa.strip(),
        "serviço de interesse": servicos,
        "volume": volume,
        "decisor": decisor,
        "prazo": prazo,
    }.items() if not v]

    return {
        "oportunidade_para_funil": oportunidade,
        "campos_extraidos": campos_extraidos,
        "pendencias": pendencias,
        "observacao": "Extração automática a partir de texto livre. Revise e confirme antes de cadastrar no funil.",
    }


if __name__ == "__main__":
    import json
    nota = (
        "Liguei para a Transportadora Vale Sul. Precisam de armazenagem e transporte. "
        "Origem: Itajaí/SC, destino Curitiba/PR. Movimentam 40 pallets por mês, com pico em dezembro. "
        "Problema: falta de espaço no armazém próprio. Quem decide é o diretor comercial. "
        "Início em novembro. Enviar proposta até sexta."
    )
    print(json.dumps(extrair(nota, empresa="Transportadora Vale Sul", responsavel="André Galão"), ensure_ascii=False, indent=2))
