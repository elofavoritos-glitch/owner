# Relatório: Propostas Comerciais Ativas — Senior Gestão Empresarial | ERP 5.10.4

> Especificação pronta para montar no **Gerador de Relatórios** da Senior e salvar como `.GER`.
> ✅ = verificado na documentação oficial 5.10.4 · ⚠️ = padrão provável, confirmar na base.

## Colunas pedidas
Número · Emissão · CNPJ do cliente · Descrição do cliente · Despachante · Representante

## Tabelas e campos (verificados na documentação oficial)
- ✅ **E120PED** — dados gerais do pedido/proposta
  - ✅ `NUMPED` — número do pedido (variável de regra `VSNumero`)
  - ✅ `SITPED` — **situação** do pedido. Valores confirmados: `1` = aberto/normal · `5` = cancelado · `9` = em edição (transitório)
  - ⚠️ `DATEMI` — data de emissão (padrão provável)
  - ⚠️ `CODCLI`, `CODREP`, `CODDPC` — chaves para cliente/representante/despachante
- ✅ **E085CLI** — cadastro de clientes
  - ✅ `CGCCPF` — CNPJ/CPF
  - ⚠️ `NOMCLI` — nome/descrição do cliente
  - ✅ `CODCLI` — código
- ✅ **E090REP** — representantes (tela `F090REP`) · ⚠️ `NOMREP`
- ⚠️ **E075DPC / E130DPC** — despachante (comum em pedidos de exportação; confirmar nome na base)

> Notação `TABELA.CAMPO` confirmada na doc (ex.: `E120IPD.CODAGC`, `E075PRO.CODAGC`, `E120PED.PRCPED`).

## SQL (SQL Senior) — colar na fonte de dados do modelo

```sql
SELECT
    PED.NUMPED                 AS NUMERO,        -- ✅ número da proposta/pedido
    PED.DATEMI                 AS EMISSAO,       -- ⚠️ data de emissão (confirmar DATEMI/DATPED)
    CLI.CGCCPF                 AS CNPJ,          -- ✅ CNPJ/CPF do cliente
    CLI.NOMCLI                 AS CLIENTE,       -- ⚠️ nome/descrição do cliente
    DPC.NOMDPC                 AS DESPACHANTE,   -- ⚠️ nome do despachante (confirmar tabela/campo)
    REP.NOMREP                 AS REPRESENTANTE  -- ⚠️ nome do representante
FROM E120PED PED
    INNER JOIN E085CLI CLI ON CLI.CODCLI = PED.CODCLI          -- ⚠️ confirmar PED.CODCLI
    LEFT  JOIN E090REP REP ON REP.CODREP = PED.CODREP          -- ⚠️ confirmar PED.CODREP
    LEFT  JOIN E075DPC DPC ON DPC.CODDPC = PED.CODDPC          -- ⚠️ despachante (confirmar)
WHERE PED.SITPED = 1                                          -- ✅ 1 = aberto/ativo (exclui cancelado=5)
ORDER BY PED.NUMPED;
```

### Observação sobre "ativas"
"Proposta ativa" = `SITPED = 1` (aberto). Se você considerar também pedidos liberados/em
andamento como "ativos", ajuste o filtro (ex.: `SITPED IN (1, ...)`). Canceladas (`5`) e o
estado transitório (`9`) ficam de fora.

### Pontos a confirmar na base (ou com o suporte Senior)
1. Nome do campo de **data de emissão** em E120PED (`DATEMI` vs `DATPED`).
2. Tabela/campo do **despachante** (varia por instalação; comum em exportação).
3. Campo de **nome do cliente** (`NOMCLI` vs razão/fantasia).
4. Se "ativa" deve incluir outras situações além de `1`.

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

> O arquivo `.GER` é o modelo binário proprietário da Senior (cabeçalho + versão TBS + corpo
> codificado) e só é gerado válido ao salvar dentro do próprio Gerador de Relatórios — não é
> produzível como texto por fora. Esta especificação cobre todo o trabalho até o "Salvar".
