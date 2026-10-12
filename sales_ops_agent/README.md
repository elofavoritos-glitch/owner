# Agentes de Operações Comerciais — ELO

Dois utilitários offline que conectam o campo à operação.

| Arquivo | Ferramenta | Para quê |
|---|---|---|
| `transcricao_funil.py` | Transcrição → funil | Notas livres → oportunidade estruturada |
| `capacidade_armazem.py` | Capacidade de armazém | "Temos espaço para esse cliente?" |

## Exemplos

```bash
cd /projects/sandbox/sales_ops_agent
python3 transcricao_funil.py
python3 capacidade_armazem.py
```

## Transcrição → funil

`extrair(texto, empresa, responsavel)` — identifica volume, serviço, origem/destino,
decisor, prazo, dor e próxima ação. Devolve uma oportunidade no formato do funil +
lista de pendências. É rascunho: confirme antes de cadastrar.

## Capacidade de armazém

`avaliar(capacidade_total, ocupadas, demanda_posicoes, margem_seguranca_percent=10)`:
- calcula posições livres úteis (após reserva de segurança);
- diz se a demanda cabe e qual a ocupação resultante;
- sem capacidade/ocupação → `sem_dados_cd`; sem demanda → `sem_demanda`.

## Princípios

- Não inventa dados; ausência vira pendência ou status explícito.
- Transcrição é rascunho; decisão de cadastro é humana.
- Não promete espaço sem checar reserva e período.
