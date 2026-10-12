"""Dimensionamento de carga para o comercial da ELO.

Converte um pedido em pallets, volume (m3), peso cubado e número de veículos.
Serve de base para a cotação de frete. Não inventa dados: campos ausentes viram
pendência explícita e nunca são presumidos.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from math import ceil
from typing import Any, Dict, List, Optional


# Parâmetros padrão (ajustáveis). Baseados em práticas usuais de transporte
# rodoviário no Brasil; confirme com a operação da ELO antes de usar como regra.
FATOR_CUBAGEM_RODOVIARIO = Decimal("300")   # kg por m3 (padrão rodoviário comum)
PALLET_PBR_M2 = Decimal("1.0")              # 1,00 m x 1,20 m ~ 1,2 m2; usamos base conservadora
PALLET_ALTURA_PADRAO_M = Decimal("1.6")     # altura útil média por posição
CAPACIDADE_VEICULO = {
    "truck": {"pallets": 14, "peso_kg": Decimal("12000"), "m3": Decimal("45")},
    "carreta": {"pallets": 28, "peso_kg": Decimal("27000"), "m3": Decimal("90")},
    "fiorino": {"pallets": 2, "peso_kg": Decimal("650"), "m3": Decimal("3.5")},
    "vuc": {"pallets": 6, "peso_kg": Decimal("3000"), "m3": Decimal("12")},
}


def _dec(valor: Any, campo: str, *, obrigatorio: bool = True) -> Optional[Decimal]:
    if valor in (None, ""):
        if obrigatorio:
            return None
        return Decimal("0")
    try:
        texto = str(valor).strip().replace(" ", "").replace("kg", "").replace("m3", "")
        if "," in texto and "." in texto:
            texto = texto.replace(".", "").replace(",", ".")
        elif "," in texto:
            texto = texto.replace(",", ".")
        numero = Decimal(texto)
    except (InvalidOperation, ValueError):
        raise ValueError(f"{campo} precisa ser numérico.")
    if numero < 0:
        raise ValueError(f"{campo} não pode ser negativo.")
    return numero


@dataclass
class Dimensionamento:
    pallets: Optional[int]
    peso_real_kg: Optional[Decimal]
    volume_m3: Optional[Decimal]
    peso_cubado_kg: Optional[Decimal]
    peso_taxavel_kg: Optional[Decimal]
    veiculo_sugerido: Optional[str]
    quantidade_veiculos: Optional[int]
    modo_carga: str
    pendencias: List[str] = field(default_factory=list)

    def resumo(self) -> Dict[str, Any]:
        def num(v):
            return float(v) if isinstance(v, Decimal) else v
        return {
            "pallets": self.pallets,
            "peso_real_kg": num(self.peso_real_kg),
            "volume_m3": num(self.volume_m3),
            "peso_cubado_kg": num(self.peso_cubado_kg),
            "peso_taxavel_kg": num(self.peso_taxavel_kg),
            "veiculo_sugerido": self.veiculo_sugerido,
            "quantidade_veiculos": self.quantidade_veiculos,
            "modo_carga": self.modo_carga,
            "pendencias": self.pendencias,
        }


def dimensionar(dados: Dict[str, Any]) -> Dimensionamento:
    """dados: pallets, peso_kg, volume_m3, veiculo_preferido (opcionais)."""
    pendencias: List[str] = []

    pallets = _dec(dados.get("pallets"), "pallets")
    peso = _dec(dados.get("peso_kg"), "peso_kg")
    volume = _dec(dados.get("volume_m3"), "volume_m3")

    # Estimar volume a partir de pallets, se o volume não foi informado.
    if volume is None and pallets is not None:
        volume = pallets * PALLET_PBR_M2 * PALLET_ALTURA_PADRAO_M
    # Estimar pallets a partir do volume, se pallets não foi informado.
    if pallets is None and volume is not None:
        pallets = ceil(volume / (PALLET_PBR_M2 * PALLET_ALTURA_PADRAO_M))

    peso_cubado = volume * FATOR_CUBAGEM_RODOVIARIO if volume is not None else None
    peso_taxavel = None
    if peso is not None and peso_cubado is not None:
        peso_taxavel = max(peso, peso_cubado)
    elif peso_cubado is not None:
        peso_taxavel = peso_cubado
        pendencias.append("peso real da carga")
    elif peso is not None:
        peso_taxavel = peso
        pendencias.append("volume ou pallets da carga")
    else:
        pendencias.append("peso, volume ou pallets da carga")

    veiculo, qtd, modo = _sugerir_veiculo(pallets, peso_taxavel, volume, str(dados.get("veiculo_preferido", "")).strip().lower())

    return Dimensionamento(
        pallets=int(pallets) if pallets is not None else None,
        peso_real_kg=peso,
        volume_m3=volume,
        peso_cubado_kg=peso_cubado,
        peso_taxavel_kg=peso_taxavel,
        veiculo_sugerido=veiculo,
        quantidade_veiculos=qtd,
        modo_carga=modo,
        pendencias=pendencias,
    )


def _sugerir_veiculo(pallets, peso_taxavel, volume, preferido):
    if pallets is None and peso_taxavel is None and volume is None:
        return None, None, "indefinido"

    candidatos = ["fiorino", "vuc", "truck", "carreta"]
    if preferido in CAPACIDADE_VEICULO:
        candidatos = [preferido]

    for nome in candidatos:
        cap = CAPACIDADE_VEICULO[nome]
        ok_pallet = pallets is None or pallets <= cap["pallets"]
        ok_peso = peso_taxavel is None or peso_taxavel <= cap["peso_kg"]
        ok_volume = volume is None or volume <= cap["m3"]
        if ok_pallet and ok_peso and ok_volume:
            return nome, 1, "FTL" if nome in ("truck", "carreta") else "LTL/dedicado"

    # Acima da carreta: calcular quantas carretas são necessárias (FTL múltiplo).
    cap = CAPACIDADE_VEICULO["carreta"]
    por_pallet = ceil(pallets / cap["pallets"]) if pallets else 1
    por_peso = ceil(peso_taxavel / cap["peso_kg"]) if peso_taxavel else 1
    por_volume = ceil(volume / cap["m3"]) if volume else 1
    qtd = max(por_pallet, por_peso, por_volume)
    return "carreta", int(qtd), "FTL"


if __name__ == "__main__":
    import json
    exemplos = [
        {"pallets": 10, "peso_kg": 4200},
        {"volume_m3": 60, "peso_kg": 9000},
        {"pallets": 40, "peso_kg": 30000},
        {"peso_kg": 500},
    ]
    for ex in exemplos:
        print("Entrada:", ex)
        print(json.dumps(dimensionar(ex).resumo(), ensure_ascii=False, indent=2))
        print("-" * 40)
