"""Agente de rotas e distâncias para o comercial da ELO.

Casos de uso:
- distância/tempo rodoviário entre cliente e destino;
- proximidade do cliente aos portos de Itajaí e Navegantes (argumento de venda);
- apoio ao dimensionamento/cotação de frete.

Depende do conector openrouteservice (HeiGIT). Se a chave não estiver
configurada, retorna status 'sem_geo' e orienta configurar ELO_ORS_API_KEY —
nunca inventa coordenadas ou distâncias.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from ors_connector import ORSClient, ORSConfig, ORSError


# Referências fixas da ELO (lon, lat). Confirme/ajuste conforme a unidade real.
PORTO_ITAJAI = (-48.6619, -26.9065)
PORTO_NAVEGANTES = (-48.6540, -26.8990)
BASE_ELO = (-48.6619, -26.9065)  # ajuste para o endereço real do CD da ELO


def _cliente() -> Optional[ORSClient]:
    try:
        return ORSClient(ORSConfig.from_env())
    except RuntimeError:
        return None


def analisar_localizacao(endereco_cliente: str, destino: str = "") -> Dict[str, Any]:
    """Geocodifica o cliente, mede proximidade dos portos e, se houver destino,
    calcula a rota cliente -> destino."""
    client = _cliente()
    if client is None:
        return {
            "status": "sem_geo",
            "mensagem": "openrouteservice não configurado. Defina ELO_ORS_API_KEY (Secret) para ativar rotas/distâncias.",
        }

    try:
        local = client.geocodificar(endereco_cliente)
    except ORSError as exc:
        return {"status": "erro_geo", "mensagem": str(exc)}

    if not local:
        return {"status": "nao_encontrado", "consulta": endereco_cliente,
                "mensagem": "Endereço não localizado. Refine o texto (rua, cidade, UF)."}

    ponto_cliente = (local["lon"], local["lat"])
    resultado: Dict[str, Any] = {
        "status": "ok",
        "cliente": local,
        "proximidade_portos": {},
    }

    # Proximidade dos portos via rota rodoviária real (não linha reta).
    try:
        rota_itajai = client.rota(ponto_cliente, PORTO_ITAJAI)
        rota_navegantes = client.rota(ponto_cliente, PORTO_NAVEGANTES)
        resultado["proximidade_portos"] = {
            "Porto de Itajaí": rota_itajai,
            "Porto de Navegantes": rota_navegantes,
            "mais_proximo": "Porto de Itajaí" if rota_itajai["distancia_km"] <= rota_navegantes["distancia_km"] else "Porto de Navegantes",
        }
    except ORSError as exc:
        resultado["proximidade_portos"] = {"erro": str(exc)}

    # Rota até o destino, se informado.
    if str(destino).strip():
        try:
            dest = client.geocodificar(destino)
            if dest:
                rota_dest = client.rota(ponto_cliente, (dest["lon"], dest["lat"]))
                resultado["rota_destino"] = {"destino": dest["rotulo"], **rota_dest}
            else:
                resultado["rota_destino"] = {"status": "destino_nao_encontrado", "consulta": destino}
        except ORSError as exc:
            resultado["rota_destino"] = {"erro": str(exc)}

    resultado["argumento_comercial"] = _argumento(resultado)
    return resultado


def _argumento(resultado: Dict[str, Any]) -> str:
    portos = resultado.get("proximidade_portos", {})
    if "mais_proximo" in portos:
        porto = portos["mais_proximo"]
        dist = portos[porto]["distancia_km"]
        tempo = portos[porto]["duracao_min"]
        return (
            f"Cliente a ~{dist} km ({tempo:.0f} min) do {porto}. "
            f"Proximidade favorece operação integrada ELO (armazenagem + transporte) com menor custo de última milha."
        )
    return "Proximidade dos portos indisponível; configurar/validar geolocalização."


if __name__ == "__main__":
    import json
    # Demonstração: exige ELO_ORS_API_KEY. Sem a chave, mostra o status 'sem_geo'.
    print(json.dumps(analisar_localizacao("Rua XV de Novembro, Blumenau, SC", destino="Curitiba, PR"), ensure_ascii=False, indent=2))
