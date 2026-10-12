"""Cotação inteligente de frete e armazenagem para resposta rápida ao comercial.

Estima faixa de preço a partir do histórico de cotações da ELO e do
dimensionamento da carga. Nunca inventa tabela: se não há histórico comparável,
retorna status 'sem_referencia' e orienta acionar o pricing.

Entrada de histórico: lista de cotações passadas, cada uma com
{servico, origem, destino, unidade, valor_unit, data}.
"""
from __future__ import annotations

import statistics
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

from dimensionamento import dimensionar

# Integração opcional com o agente de geolocalização (openrouteservice).
# Import tolerante: se o módulo/credencial não existir, a cotação segue sem geo.
_GEO_DIR = Path(__file__).resolve().parent.parent / "geo_agent"
if _GEO_DIR.is_dir() and str(_GEO_DIR) not in sys.path:
    sys.path.insert(0, str(_GEO_DIR))

try:
    from rotas import analisar_localizacao as _analisar_localizacao  # type: ignore
except Exception:  # pragma: no cover - geo é opcional
    _analisar_localizacao = None


def geo_disponivel() -> bool:
    return _analisar_localizacao is not None


def _norm(texto: Any) -> str:
    return str(texto or "").strip().lower()


def _moeda(valor: float) -> str:
    s = f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


@dataclass
class FaixaPreco:
    servico: str
    unidade: str
    minimo: Optional[float]
    mediana: Optional[float]
    maximo: Optional[float]
    base_amostras: int
    status: str
    observacao: str = ""

    def resumo(self) -> Dict[str, Any]:
        return {
            "servico": self.servico,
            "unidade": self.unidade,
            "faixa": {
                "minimo": self.minimo,
                "mediana": self.mediana,
                "maximo": self.maximo,
            },
            "amostras": self.base_amostras,
            "status": self.status,
            "observacao": self.observacao,
        }


def _faixa_por_servico(
    historico: List[Dict[str, Any]],
    servico: str,
    *,
    origem: str = "",
    destino: str = "",
) -> FaixaPreco:
    servico_norm = _norm(servico)
    origem_norm = _norm(origem)
    destino_norm = _norm(destino)

    def combina(item: Dict[str, Any], usar_rota: bool) -> bool:
        if _norm(item.get("servico")) != servico_norm:
            return False
        if not usar_rota:
            return True
        if origem_norm and origem_norm not in _norm(item.get("origem")):
            return False
        if destino_norm and destino_norm not in _norm(item.get("destino")):
            return False
        return True

    # 1ª tentativa: mesma rota. 2ª tentativa: mesmo serviço (qualquer rota).
    amostras = [i for i in historico if combina(i, usar_rota=True)]
    nota = ""
    if len(amostras) < 3:
        amostras = [i for i in historico if combina(i, usar_rota=False)]
        if amostras:
            nota = "Faixa baseada no serviço (rota específica sem histórico suficiente)."

    valores = []
    unidade = ""
    for item in amostras:
        try:
            valores.append(float(Decimal(str(item["valor_unit"]))))
            unidade = unidade or str(item.get("unidade", "")).strip()
        except Exception:
            continue

    if not valores:
        return FaixaPreco(servico, unidade or "unidade", None, None, None, 0,
                          "sem_referencia",
                          "Sem histórico comparável. Acione o pricing para cotar.")

    minimo = round(min(valores), 2)
    maximo = round(max(valores), 2)
    mediana = round(statistics.median(valores), 2)
    status = "estimado" if len(valores) >= 3 else "indicativo"
    if status == "indicativo" and not nota:
        nota = "Poucas amostras; use como indicativo e valide com o pricing."
    return FaixaPreco(servico, unidade or "unidade", minimo, mediana, maximo, len(valores), status, nota)


def cotar(
    pedido: Dict[str, Any],
    historico: Optional[List[Dict[str, Any]]] = None,
    *,
    usar_geo: bool = True,
) -> Dict[str, Any]:
    """pedido: {servicos:[...], origem, destino, carga:{pallets,peso_kg,volume_m3}, meses_armazenagem}.

    usar_geo: quando True e o openrouteservice estiver configurado, calcula a
    distância rodoviária real e a proximidade dos portos, anexando ao resultado.
    A cotação funciona normalmente sem geolocalização.
    """
    historico = historico or []
    servicos = [s for s in pedido.get("servicos", []) if str(s).strip()]
    if not servicos:
        raise ValueError("Informe ao menos um serviço (armazenagem e/ou transporte).")

    origem = pedido.get("origem", "")
    destino = pedido.get("destino", "")
    carga = pedido.get("carga", {}) or {}
    dim = dimensionar(carga)

    linhas: List[Dict[str, Any]] = []
    pendencias: List[str] = list(dim.pendencias)
    total_min = total_max = 0.0
    tem_referencia = False

    for servico in servicos:
        faixa = _faixa_por_servico(historico, servico, origem=origem, destino=destino)
        quantidade, base_qtd = _quantidade_para(servico, dim, carga, pedido)
        linha = {"servico": servico, "faixa_unitaria": faixa.resumo(), "quantidade": quantidade, "base_quantidade": base_qtd}
        if faixa.minimo is not None and quantidade is not None:
            sub_min = round(faixa.minimo * quantidade, 2)
            sub_max = round(faixa.maximo * quantidade, 2)
            linha["subtotal_estimado"] = {"minimo": sub_min, "maximo": sub_max,
                                          "exibicao": f"{_moeda(sub_min)} a {_moeda(sub_max)}"}
            total_min += sub_min
            total_max += sub_max
            tem_referencia = True
        else:
            linha["subtotal_estimado"] = None
            if quantidade is None:
                pendencias.append(f"quantidade para {servico}")
        linhas.append(linha)

    geo = _geolocalizacao(origem, destino) if usar_geo else {"status": "desativado"}

    return {
        "origem": origem,
        "destino": destino,
        "dimensionamento": dim.resumo(),
        "geolocalizacao": geo,
        "itens": linhas,
        "total_estimado": {
            "minimo": round(total_min, 2) if tem_referencia else None,
            "maximo": round(total_max, 2) if tem_referencia else None,
            "exibicao": f"{_moeda(total_min)} a {_moeda(total_max)}" if tem_referencia else "sem referência de preço",
        },
        "pendencias": sorted(set(pendencias)),
        "aviso": "Estimativa para resposta rápida. Valor final sujeito à validação do pricing e das premissas.",
    }


def _geolocalizacao(origem: str, destino: str) -> Dict[str, Any]:
    """Enriquece a cotação com distância real e proximidade dos portos.

    Degrada com segurança: sem módulo geo ou sem chave, retorna um status e a
    cotação segue válida. Nunca inventa distância.
    """
    if _analisar_localizacao is None:
        return {"status": "indisponivel", "mensagem": "Agente de geolocalização não carregado."}
    if not str(origem).strip():
        return {"status": "sem_origem", "mensagem": "Informe a origem/endereço do cliente para calcular distância."}
    try:
        resultado = _analisar_localizacao(origem, destino=destino)
    except Exception as exc:  # pragma: no cover - rede externa
        return {"status": "erro", "mensagem": str(exc)}

    if resultado.get("status") != "ok":
        return resultado  # repassa sem_geo / nao_encontrado etc.

    portos = resultado.get("proximidade_portos", {})
    rota_destino = resultado.get("rota_destino", {})
    return {
        "status": "ok",
        "cliente": resultado.get("cliente", {}).get("rotulo", ""),
        "porto_mais_proximo": portos.get("mais_proximo"),
        "distancia_porto_km": (portos.get(portos.get("mais_proximo", ""), {}) or {}).get("distancia_km"),
        "rota_ate_destino": {
            "destino": rota_destino.get("destino"),
            "distancia_km": rota_destino.get("distancia_km"),
            "duracao_min": rota_destino.get("duracao_min"),
        } if rota_destino.get("distancia_km") is not None else None,
        "argumento_comercial": resultado.get("argumento_comercial"),
    }


def _quantidade_para(servico: str, dim, carga: Dict[str, Any], pedido: Dict[str, Any]):
    s = _norm(servico)
    if "armazenagem" in s:
        pallets = dim.pallets
        meses = pedido.get("meses_armazenagem", 1)
        if pallets is None:
            return None, "pallets/mês"
        return pallets * (meses or 1), f"{pallets} pallets x {meses or 1} mês(es)"
    if "transporte" in s:
        if dim.quantidade_veiculos is None:
            return None, "viagens"
        return dim.quantidade_veiculos, f"{dim.quantidade_veiculos} viagem(ns) ({dim.veiculo_sugerido})"
    return None, "unidade"


if __name__ == "__main__":
    import json
    historico = [
        {"servico": "Armazenagem", "origem": "Itajaí/SC", "destino": "Itajaí/SC", "unidade": "pallet/mês", "valor_unit": 40, "data": "2026-08-01"},
        {"servico": "Armazenagem", "origem": "Itajaí/SC", "destino": "Itajaí/SC", "unidade": "pallet/mês", "valor_unit": 45, "data": "2026-09-01"},
        {"servico": "Armazenagem", "origem": "Itajaí/SC", "destino": "Itajaí/SC", "unidade": "pallet/mês", "valor_unit": 43, "data": "2026-10-01"},
        {"servico": "Transporte rodoviário", "origem": "Itajaí/SC", "destino": "Curitiba/PR", "unidade": "viagem", "valor_unit": 950, "data": "2026-09-10"},
        {"servico": "Transporte rodoviário", "origem": "Itajaí/SC", "destino": "Curitiba/PR", "unidade": "viagem", "valor_unit": 1050, "data": "2026-09-20"},
        {"servico": "Transporte rodoviário", "origem": "Itajaí/SC", "destino": "Curitiba/PR", "unidade": "viagem", "valor_unit": 1000, "data": "2026-10-02"},
    ]
    pedido = {
        "servicos": ["Armazenagem", "Transporte rodoviário"],
        "origem": "Itajaí/SC",
        "destino": "Curitiba/PR",
        "meses_armazenagem": 1,
        "carga": {"pallets": 20, "peso_kg": 9000},
    }
    print(json.dumps(cotar(pedido, historico), ensure_ascii=False, indent=2))
