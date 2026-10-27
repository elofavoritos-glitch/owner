# Agentes de Gestão Comercial — ELO

Três ferramentas para o líder comercial, offline e sobre o funil que já existe.

| Arquivo | Ferramenta | Para quê |
|---|---|---|
| `painel_gestor.py` | Painel do gestor | Funil por vendedor/etapa, previsão ponderada, risco |
| `metas_ranking.py` | Metas e ranking | Atingimento, projeção pelo ritmo, quem precisa de apoio |
| `distribuicao_leads.py` | Distribuição de leads | Sugere o vendedor ideal por região/especialidade/carga |

## Exemplos

```bash
cd /projects/sandbox/sales_management_agent
python3 painel_gestor.py
python3 metas_ranking.py
python3 distribuicao_leads.py
```

## Painel do gestor

`gerar_painel(oportunidades)` — usa o mesmo formato do funil. Retorna totais,
previsão ponderada (Σ valor × probabilidade), taxa de conversão, visão por
vendedor e por etapa, e as oportunidades em risco (sem próxima ação ou atrasadas).

## Metas e ranking

`ranking(realizados, metas, dia_do_mes, dias_no_mes)` — atingimento e projeção
simples pelo ritmo do mês; aponta quem precisa de apoio. Sem meta → pendência.

## Distribuição de leads

`sugerir_responsavel(lead, vendedores)` — pontua por região (40), especialidade
(30), carga de trabalho (20) e disponibilidade (10). Vendedor indisponível não é
recomendado, mesmo com pontuação alta. A atribuição final é do gestor.

## Princípios

- Não inventa meta, resultado ou dado de oportunidade; o que falta vira pendência.
- Sugestões são explicáveis; decisão final é humana.
- Pesos e parâmetros ajustáveis no topo dos arquivos.
