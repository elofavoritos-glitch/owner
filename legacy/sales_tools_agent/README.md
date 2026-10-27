# Ferramentas de Vendas — ELO

Cinco ferramentas rápidas para o comercial, offline e sem inventar dados.

| Arquivo | Ferramenta | Para quê |
|---|---|---|
| `cotacao_frete.py` | Cotação inteligente de frete | Faixa de preço na hora (histórico + dimensionamento) |
| `dimensionamento.py` | Dimensionamento de carga | Pallets, m³, peso cubado, veículo sugerido |
| `produtividade.py` | Agenda do dia / Follow-up / Reativação | Foco diário e recuperação de oportunidades |

## Como usar (exemplos)

```bash
cd /projects/sandbox/sales_tools_agent
python3 dimensionamento.py     # exemplos de dimensionamento
python3 cotacao_frete.py       # cotação com histórico de exemplo
python3 produtividade.py       # agenda, follow-ups e reativação
```

## Cotação de frete

`cotar(pedido, historico, usar_geo=True)`:
- `pedido`: `{servicos, origem, destino, meses_armazenagem, carga:{pallets, peso_kg, volume_m3}}`
- `historico`: cotações passadas da ELO `{servico, origem, destino, unidade, valor_unit, data}`

Retorna faixa mín.–máx. por serviço e total. Sem histórico comparável → `sem_referencia`.

**Geolocalização (opcional):** quando `usar_geo=True` e o openrouteservice estiver
configurado (`geo_agent`), a cotação inclui `geolocalizacao` com distância real
até o destino, porto mais próximo e argumento comercial. Sem chave, retorna
`status: sem_geo` e a cotação segue válida. Use `usar_geo=False` para desligar.

## Princípios

- Cotação é **estimativa indicativa**; valor final é do pricing.
- Nenhuma ferramenta envia e-mail; follow-up/reativação apenas sugerem.
- Parâmetros (cubagem, capacidades, limites de dias) são ajustáveis no topo dos arquivos.
