# Agente de Capitalização Comercial — ELO

Inteligência comercial para **armazenagem** e **transporte rodoviário**, funcionando
offline com os dados que a ELO já possui. Logcomex e Econodata entram depois.

## Componentes

| Arquivo | Função |
|---|---|
| `perfil_elo.py` | Serviços vendidos, ICP e pesos do score (fonte única). |
| `scoring.py` | Score 0–100 explicável, com justificativa e fonte por critério. |
| `diagnostico.py` | Diagnóstico logístico guiado por perguntas. |
| `relacionamento.py` | "Já falamos com essa empresa?" via Outlook (`/me`). |
| `dossie.py` | Dossiê pré-reunião + próxima melhor ação. |
| `demo.py` | Demonstração offline do fluxo completo. |
| `connectors/` | Econodata e Logcomex preparados (desativados). |

## Demonstração

```bash
cd /projects/sandbox/sales_intelligence_agent
python3 demo.py
```

## Score

Critérios e pesos iniciais (somam 100): aderência ao ICP (25), atividade logística (25),
potencial para armazenagem/transporte (20), região e rotas (10), relacionamento anterior (10),
sinal recente (10). Sem evidência, o critério não pontua e vira pendência.

Prioridade: Alta ≥ 70, Média ≥ 45, Baixa < 45. Pesos ajustáveis em `perfil_elo.py`.

## Princípios

- Nunca inventa dados; registra fonte e pendências.
- Usa apenas a caixa do usuário autenticado.
- Sem prospecção automática em massa; envio sempre com confirmação humana.
- Apenas dados públicos ou licenciados.

## Integrações futuras

Defina os Secrets e implemente a consulta nos conectores:

```text
ELO_ECONODATA_API_KEY
ELO_LOGCOMEX_API_KEY
```
