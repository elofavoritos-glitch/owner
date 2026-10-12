# Agente de Geolocalização e Rotas — ELO

Geocoding, rotas rodoviárias e distâncias via **openrouteservice (HeiGIT)**.

| Arquivo | Função |
|---|---|
| `ors_connector.py` | Conector ORS: geocoding (Pelias), directions e matrix. |
| `rotas.py` | Agente de rotas: distância/tempo e proximidade dos portos de Itajaí/Navegantes. |

## Configuração

1. Crie uma chave gratuita no openrouteservice (painel de desenvolvedor → Tokens).
2. Configure como Secret/variável de ambiente — nunca no código:

```text
ELO_ORS_API_KEY=<sua-chave>
ELO_ORS_PROFILE=driving-hgv     # veículo de carga (padrão). Use driving-car para leve.
ELO_ORS_BASE_URL=https://api.openrouteservice.org   # host api.heigit.org também aceito
```

3. Libere a rede do sandbox para o host do ORS em
   **Settings → Agent → Sandbox → Internet access → Custom allow-list**:

```text
api.openrouteservice.org
```

(se usar o host HeiGIT, adicione também `api.heigit.org`)

## Uso

```python
from rotas import analisar_localizacao
r = analisar_localizacao("Rua XV de Novembro, Blumenau, SC", destino="Curitiba, PR")
```

Retorna coordenadas do cliente, distância/tempo até cada porto, o porto mais
próximo, a rota até o destino e um argumento comercial pronto.

## Serviços do conector

- `geocodificar(texto)` — endereço → coordenadas (Pelias).
- `rota(origem, destino)` — distância (km) e duração (min) rodoviária.
- `matriz(pontos)` — distâncias/tempos entre vários pontos.

## Princípios

- Sem chave → `status: sem_geo`; nunca inventa coordenadas ou distâncias.
- Endereço não encontrado → `nao_encontrado` (pede refinamento).
- Respeita limites do ORS (backoff em 429/503).
- Perfil padrão `driving-hgv` (carga); ajuste conforme o veículo.
