# Agente de Excel — Comercial ELO

Gera arquivos Microsoft Excel (`.xlsx`) reais para **cotação logística** e **funil comercial**, sem internet e sem bibliotecas externas.

## Estrutura

| Arquivo | Função |
|---|---|
| `xlsx_writer.py` | Motor OOXML: células tipadas, fórmulas, estilos, datas, moeda, percentuais, filtros, painéis congelados, mesclagens e listas controladas. |
| `gerar_cotacao.py` | Cotação com abas Resumo, Itens e Premissas. |
| `gerar_funil.py` | Pipeline com abas Resumo, Oportunidades e Listas. |
| `output/` | Planilhas geradas. |

## Uso rápido

```bash
cd /projects/sandbox/excel_agent
python3 gerar_cotacao.py
python3 gerar_funil.py
```

Os comandos geram exemplos demonstrativos em `output/`. Substitua os marcadores antes do uso real.

## Cotação logística

A função `gerar_cotacao(dados)` exige:

```python
{
    "numero": "COT-001",
    "responsavel": "Equipe Comercial ELO",
    "validade": "15 dias",
    "cliente": {
        "empresa": "[CLIENTE]",
        "cnpj": "[PREENCHER CNPJ]",
        "contato": "[PREENCHER CONTATO]",
        "email": "[PREENCHER E-MAIL]",
    },
    "operacao": {
        "servico": "Armazenagem e distribuição",
        "modal": "Rodoviário",
        "origem": "Itajaí/SC",
        "destino": "[PREENCHER DESTINO]",
        "equipamento": "[PREENCHER]",
        "volume": "[PREENCHER]",
    },
    "itens": [{
        "descricao": "Armazenagem mensal",
        "unidade": "pallet/mês",
        "qtd": 30,
        "valor_unit": 42.50,
        "adicionais": 0,
        "impostos": 0,
        "classificacao": "Estimativa",
    }],
    "premissas": [{
        "categoria": "Volume",
        "descricao": "30 pallets por mês",
        "status": "Estimativa",
        "fonte": "Briefing comercial",
        "observacao": "Validar antes do envio.",
    }],
}
```

`adicionais` e `impostos` são obrigatórios. Use `0` somente quando a ausência do custo foi confirmada.

## Funil comercial

A função `gerar_funil(oportunidades)` recebe uma lista. Cada oportunidade exige ID único, cliente, serviço, etapa, status, responsável, valor potencial e probabilidade entre `0` e `1`.

Etapas disponíveis: `Prospecção`, `Qualificação`, `Diagnóstico`, `Cotação`, `Negociação`, `Ganho`, `Perdido`.

Status disponíveis: `Ativa`, `Em espera`, `Ganha`, `Perdida`.

Datas podem ser objetos Python ou textos `dd/mm/aaaa`/`aaaa-mm-dd`. O valor ponderado é calculado como valor potencial × probabilidade.

## Validação

Cada gerador chama `validate_xlsx`, que verifica:

- extensão `.xlsx`;
- integridade do ZIP;
- presença das partes obrigatórias;
- validade de todos os XMLs;
- nomes e quantidade das abas.

A validação estrutural não substitui renderização manual no Microsoft Excel. O Microsoft Excel/LibreOffice não está instalado no sandbox atual.

## Segurança de dados

- Textos são gravados como texto, mesmo quando começam com `=`; isso reduz risco de injeção de fórmulas.
- Apenas fórmulas fixas do template são emitidas.
- Exemplos usam marcadores e não representam clientes reais.
- O agente nunca deve presumir dados financeiros ou operacionais.
