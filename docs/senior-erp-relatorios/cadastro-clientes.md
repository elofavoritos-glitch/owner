# Relatório: Cadastro de Clientes — Senior Gestão Empresarial | ERP

> Especificação pronta para montar no **Gerador de Relatórios** da Senior e salvar como `.GER`.
> Lista **todos os cadastros de clientes** do ERP.
> ✅ = verificado na documentação oficial · ⚠️ = padrão provável, confirmar na base (F8 / dicionário de dados).

## Colunas do relatório
Código · Nome/Razão social · CNPJ/CPF · Cidade · UF · Situação

## Tabela e campos
- ✅ **E085CLI** — cadastro de clientes (confirmado na doc: Data Mart de Clientes e identificador `GER-085CADCL01`; exemplo de SQL oficial usa `e085cli` com `codcli`, `nomcli`).
  - ✅ `CODCLI` — código do cliente
  - ✅ `NOMCLI` — nome / razão social do cliente
  - ✅ `CGCCPF` — CNPJ/CPF (campo confirmado no web service `com.senior.g5.co.cad.clientes`)
  - ⚠️ `SITCLI` — situação do cliente (ex.: `A` = Ativo, `I` = Inativo). O campo de
    situação do cliente pode exigir habilitação na tela F085CAD (ver nota abaixo).
  - ⚠️ `NOMMUN` / `CODMUN` — município (nome/código). Confirmar se a cidade está em
    E085CLI ou precisa de join com a tabela de municípios.
  - ⚠️ `SIGUFS` / `UFSCLI` — UF do cliente.

> Dica: para achar o nome técnico exato de qualquer campo, use o **dicionário de
> dados (tecla F8)** na tela de cadastro de clientes (F085CAD), ou o **CBDS**.

## SQL (SQL Senior) — colar na fonte de dados do modelo

```sql
SELECT
    CLI.CODCLI                 AS CODIGO,       -- ✅ código do cliente
    CLI.NOMCLI                 AS NOME,         -- ✅ nome / razão social
    CLI.CGCCPF                 AS CNPJ_CPF,     -- ✅ CNPJ/CPF
    CLI.NOMMUN                 AS CIDADE,       -- ⚠️ município (confirmar campo/join)
    CLI.SIGUFS                 AS UF,           -- ⚠️ UF (confirmar campo)
    CLI.SITCLI                 AS SITUACAO      -- ⚠️ situação (A=ativo / I=inativo)
FROM E085CLI CLI
ORDER BY CLI.NOMCLI;
```

### Variações úteis
- **Só clientes ativos:** adicionar `WHERE CLI.SITCLI = 'A'` (confirmar o valor na base).
- **Por UF:** adicionar `WHERE CLI.SIGUFS = 'SC'` (ou a UF desejada).
- **Faixa de código:** `WHERE CLI.CODCLI BETWEEN :codIni AND :codFim` (parâmetros de Pré-Seleção).

### Pontos a confirmar na base (F8 / CBDS / suporte Senior)
1. Nome técnico exato dos campos de **cidade** (`NOMMUN` vs join com tabela de municípios) e **UF** (`SIGUFS`).
2. Se `SITCLI` está disponível/habilitado (a doc indica que a situação do cliente
   pode precisar ser habilitada em F085CAD) e quais os valores válidos.
3. Se "nome" deve ser razão social, nome fantasia ou apelido (há mais de um campo de nome em E085CLI).

## Estrutura das seções do modelo
| Seção | Conteúdo |
|---|---|
| Cabeçalho da página | Título "Cadastro de Clientes" · data do relatório · página |
| Cabeçalho de coluna | Código · Nome · CNPJ/CPF · Cidade · UF · Situação |
| Detalhe | 1 linha por cliente (os 6 campos). Classificação por NOME |
| Rodapé | Contagem total de clientes |

## Passo a passo para gerar o .GER na ferramenta Senior
1. Abra o **Gerador de Relatórios**.
2. Menu **Modelo > Novo** → tipo **Gráfico** (formatado) ou **Texto** (listagem simples).
3. Na **fonte de dados**, cole o **SQL** acima (ajuste os ⚠️ conforme a base).
4. Confira os **campos retornados** (ficam disponíveis para arrastar).
5. Monte as **seções** conforme a tabela; arraste os campos para o **Detalhe**.
6. Defina a **Classificação** da seção Detalhe por `NOME`.
7. (Opcional) Rodapé: fórmula de **contagem** de registros.
8. Menu **Modelo > Salvar** → nomeie no padrão **CATNNN.GER**.
9. **Teste em homologação** e confira os números.

> O arquivo `.GER` é o modelo binário proprietário da Senior e só é gerado válido ao
> salvar dentro do próprio Gerador de Relatórios. Esta especificação cobre todo o
> trabalho até o "Salvar como .GER".
