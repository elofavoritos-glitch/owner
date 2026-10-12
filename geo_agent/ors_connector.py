"""Conector openrouteservice (HeiGIT) para geocoding, rotas e matriz.

Serviços usados:
- Geocoding (Pelias): endereço -> coordenadas.
- Directions: rota rodoviária com distância e duração.
- Matrix: distância/tempo entre múltiplas origens e destinos.

A chave vem de ELO_ORS_API_KEY (variável de ambiente / Secret), nunca do código.
Base padrão: https://api.openrouteservice.org  (host api.heigit.org também aceito).
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


Coord = Tuple[float, float]  # (lon, lat) — padrão GeoJSON/ORS


class ORSError(RuntimeError):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(f"openrouteservice {status}: {message}")
        self.status = status


@dataclass
class ORSConfig:
    api_key: str
    base_url: str = "https://api.openrouteservice.org"
    profile: str = "driving-hgv"   # veículo de carga; use 'driving-car' para leve
    timeout: int = 30
    max_retries: int = 3

    @classmethod
    def from_env(cls) -> "ORSConfig":
        key = os.environ.get("ELO_ORS_API_KEY", "").strip()
        if not key:
            raise RuntimeError("Configure ELO_ORS_API_KEY (Secret) para usar o openrouteservice.")
        base = os.environ.get("ELO_ORS_BASE_URL", "https://api.openrouteservice.org").strip()
        profile = os.environ.get("ELO_ORS_PROFILE", "driving-hgv").strip()
        return cls(api_key=key, base_url=base, profile=profile)


class ORSClient:
    def __init__(self, config: Optional[ORSConfig] = None) -> None:
        self.config = config or ORSConfig.from_env()

    # ---- HTTP -----------------------------------------------------------
    def _request(self, method: str, path: str, *, params: Optional[dict] = None, body: Optional[dict] = None) -> Any:
        url = self.config.base_url.rstrip("/") + path
        if params:
            url += "?" + urllib.parse.urlencode(params, safe=",:")
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {
            "Authorization": self.config.api_key,
            "Accept": "application/json, application/geo+json",
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "ELO-Comercial-Geo/1.0",
        }
        last_error: Optional[Exception] = None
        for attempt in range(self.config.max_retries):
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                raw = exc.read().decode("utf-8", errors="replace")
                # 429/503: respeita backoff; demais erros não são repetidos.
                if exc.code in (429, 503) and attempt + 1 < self.config.max_retries:
                    retry_after = exc.headers.get("Retry-After")
                    time.sleep(float(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt)
                    last_error = exc
                    continue
                try:
                    msg = json.loads(raw).get("error", raw)
                    if isinstance(msg, dict):
                        msg = msg.get("message", str(msg))
                except json.JSONDecodeError:
                    msg = raw
                raise ORSError(exc.code, str(msg)) from exc
            except urllib.error.URLError as exc:
                last_error = exc
                if attempt + 1 < self.config.max_retries:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"ORS_UNAVAILABLE: {exc}") from exc
        raise RuntimeError(f"ORS_RETRY_EXHAUSTED: {last_error}")

    # ---- Geocoding (Pelias) --------------------------------------------
    def geocodificar(self, texto: str, *, pais: str = "BR", tamanho: int = 1) -> Optional[Dict[str, Any]]:
        if not str(texto).strip():
            raise ValueError("Informe o endereço/local para geocodificar.")
        params = {
            "api_key": self.config.api_key,
            "text": texto,
            "boundary.country": pais,
            "size": tamanho,
        }
        data = self._request("GET", "/geocode/search", params=params)
        feats = data.get("features") or []
        if not feats:
            return None
        melhor = feats[0]
        lon, lat = melhor["geometry"]["coordinates"][:2]
        props = melhor.get("properties", {})
        return {
            "consulta": texto,
            "lon": lon,
            "lat": lat,
            "rotulo": props.get("label", ""),
            "confianca": props.get("confidence"),
            "fonte": "openrouteservice/pelias",
        }

    # ---- Directions (rota rodoviária) ----------------------------------
    def rota(self, origem: Coord, destino: Coord) -> Dict[str, Any]:
        body = {"coordinates": [list(origem), list(destino)]}
        path = f"/v2/directions/{self.config.profile}"
        data = self._request("POST", path, body=body)
        resumo = data["routes"][0]["summary"]
        return {
            "distancia_km": round(resumo["distance"] / 1000, 1),
            "duracao_min": round(resumo["duration"] / 60, 1),
            "perfil": self.config.profile,
            "fonte": "openrouteservice/directions",
        }

    # ---- Matrix (vários pontos) ----------------------------------------
    def matriz(self, pontos: List[Coord], *, origens: Optional[List[int]] = None, destinos: Optional[List[int]] = None) -> Dict[str, Any]:
        if len(pontos) < 2:
            raise ValueError("A matriz exige ao menos dois pontos.")
        body: Dict[str, Any] = {
            "locations": [list(p) for p in pontos],
            "metrics": ["distance", "duration"],
            "units": "km",
        }
        if origens is not None:
            body["sources"] = origens
        if destinos is not None:
            body["destinations"] = destinos
        path = f"/v2/matrix/{self.config.profile}"
        data = self._request("POST", path, body=body)
        return {
            "distancias_km": data.get("distances"),
            "duracoes_s": data.get("durations"),
            "fonte": "openrouteservice/matrix",
        }
