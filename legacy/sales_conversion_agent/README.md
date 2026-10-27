# Agentes de Conversão — ELO

Quatro ferramentas para avançar e fechar vendas, offline e sem inventar dados.

| Arquivo | Ferramenta | Para quê |
|---|---|---|
| `qualificacao.py` | Qualificação BANT + SPIN | Lead está pronto para proposta? |
| `objecoes.py` | Tratamento de objeções | Respostas para "caro", "já tenho operador"... |
| `venda_cruzada.py` | Venda cruzada | Transporte → armazenagem (e vice-versa) |
| `ata_reuniao.py` | Ata de reunião | Anotações → ata + próxima ação (PDF opcional) |

## Exemplos

```bash
cd /projects/sandbox/sales_conversion_agent
python3 qualificacao.py
python3 objecoes.py
python3 venda_cruzada.py
python3 ata_reuniao.py     # gera também a ata em PDF
```

## Qualificação (BANT + SPIN)

- BANT (orçamento, autoridade, necessidade, prazo) → score 0–100.
- SPIN (situação, problema, implicação, necessidade) → contexto da abordagem.
- Pronto para proposta ≥ 70 com necessidade confirmada; sem respostas → pendências.

## Objeções

Identifica: preço, operador atual, sem volume, sem tempo, só material, análise
interna. Desconhecida → pergunta aberta. Entrega argumentos e perguntas, **nunca
promessa** de preço/prazo.

## Princípios

- Não inventa dados; o que falta vira pendência.
- Objeção e ata são consultivas; nada é enviado automaticamente.
- Catálogos (objeções, pesos BANT) ajustáveis no topo dos arquivos.
