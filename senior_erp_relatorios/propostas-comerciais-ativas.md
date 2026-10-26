# Relatório: Propostas Comerciais Ativas — Senior Gestão Empresarial | ERP 5.10.4

> Especificação pronta para montar no **Gerador de Relatórios** da Senior e salvar como `.GER`.
> Nomes de tabelas/campos marcados com ✅ foram verificados na documentação oficial 5.10.4; os marcados com ⚠️ são padrão provável da Senior e devem ser confirmados na sua base.

## Colunas pedidas
Número · Emissão · CNPJ do cliente · Descrição do cliente · Despachante · Representante

## Tabelas (verificadas na documentação oficial)
- ✅ **E120PED** — dados gerais do pedido/proposta (campo ✅ `NUMPED` = número do pedido)
- ✅ **E085CLI** — cadastro de clientes (✅ `CGCCPF` = CNPJ/CPF; `CODCLI` = código)
- ✅ **E090REP** — representantes (tela `F090REP`)
- ⚠️ **E130DPC / E085DPC** — despachante (a confirmar o nome real na base)

## SQL (SQL Senior) — colar na fonte de dados do modelo

```sql
SELECT
    PED.NUMPED                 AS NUMERO,        -- ✅ número da proposta/pedido
    PED.DATEMI                 AS EMISSAO,       -- ⚠️ data de emissão (confirmar: DATEMI/DATPED)
    CLI.CGCCPF                 AS CNPJ,          -- ✅ CNPJ/CPF do cliente
    CLI.NOMCLI                 AS CLIENTE,       -- ⚠️ nome/descrição do cliente (confirmar NOMCLI/NOMFAN)
    DPC.NOMDPC                 AS DESPACHANTE,   -- ⚠️ nome do despachante (confirmar tabela/campo)
    REP.NOMREP                 AS REPRESENTANTE  -- ⚠️ nome do representante (confirmar NOMREP)
FROM E120PED PED
    INNER JOIN E085CLI CLI ON CLI.CODCLI = PED.CODCLI          -- ⚠️ confirmar PED.CODCLI
    LEFT  JOIN E090REP REP ON REP.CODREP = PED.CODREP          -- ⚠️ confirmar PED.CODREP
    LEFT  JOIN E130DPC DPC ON DPC.CODDPC = PED.CODDPC          -- ⚠️ despachante (confirmar)
WHERE PED.SITPED = 'A'                                         -- ⚠️ situação Ativa/Aberta (confirmar domínio)
ORDER BY PED.NUMPED;
```

### Pontos a confirmar na sua base (ou pergunte ao suporte Senior)
1. Campo de **data de emissão** em E120PED (provável `DATEMI` ou `DATPED`).
2. Campo de **situação** e qual valor significa "ativa"/"aberta" (`SITPED`).
3. **Despachante**: tabela e campo corretos (varia bastante por instalação).
4. Campo de **nome do cliente** (`NOMCLI` vs. razão/fantasia).

## Estrutura das seções do modelo
| Seção | Conteúdo |
|---|---|
| Cabeçalho da página | Título "Propostas Comerciais Ativas" · data do relatório · página |
| Cabeçalho de coluna | Número · Emissão · CNPJ · Cliente · Despachante · Representante |
| Detalhe | 1 linha por registro (os 6 campos). Classificação por NUMERO |
| Rodapé | Contagem total de propostas |

## Passo a passo para gerar o .GER na ferramenta Senior
1. Abra o **Gerador de Relatórios**.
2. Menu **Modelo > Novo** → tipo **Gráfico** (ou **Texto** para listagem simples).
3. Na **fonte de dados**, cole o **SQL** acima (com os ⚠️ ajustados).
4. Confira os **campos retornados** (ficam disponíveis para arrastar).
5. Monte as **seções** conforme a tabela; arraste os campos para o **Detalhe**.
6. Defina **Classificação** da seção Detalhe por `NUMERO`.
7. (Opcional) Rodapé: fórmula de **contagem** de registros.
8. Menu **Modelo > Salvar** → nomeie no padrão **CATNNN.GER**.
9. **Teste em homologação** e confira os números.

> Observação técnica: o arquivo `.GER` é o modelo binário proprietário da ferramenta Senior (cabeçalho + versão TBS + corpo codificado). Ele só é gerado válido ao salvar dentro do próprio Gerador de Relatórios — não é produzível como texto por fora. Esta especificação entrega tudo que automatiza o trabalho até o "Salvar".
