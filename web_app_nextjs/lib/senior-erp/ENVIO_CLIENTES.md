# Envio de clientes do Senior ERP para o painel

## Por que assim

O ERP da ELO (G5) roda na Senior Cloud (`antares.seniorcloud.com.br`). Esse
servidor **não aceita conexões de fora**, então o painel não consegue buscar os
dados. Ele **consegue sair** para a internet: em 30/10/2026 o Chrome do servidor
abriu `https://owner-webappnextjs.vercel.app/api/health`.

Por isso a integração funciona ao contrário: uma **regra LSP no ERP** lê a
tabela de clientes (E085CLI) e envia para o painel. Não depende da Senior.

```
ERP (regra LSP)  --HttpPost-->  /api/senior/clientes  --rpc-->  Supabase (clientes)
```

## Peças

| Arquivo | Papel |
|---|---|
| `supabase/senior_sync.sql` | Colunas de vínculo, tabela de token e função `senior_receber_clientes()`. Gera o token. |
| `app/api/senior/clientes/route.ts` | Recebe o POST do ERP. `GET` responde um ping. |
| `lib/senior-erp/recebimento.ts` | Lê o formato `ELO1` e normaliza CNPJ/CPF. Testes em `recebimento.test.ts`. |
| `lib/senior-erp/regra-envio-clientes.lsp` | A regra para colar no ERP. |

## Passo a passo

### 1. Banco (Supabase, uma vez)
1. Supabase → **SQL Editor** → **New query**.
2. Cole todo o conteúdo de `supabase/senior_sync.sql` → **Run**.
3. O resultado mostra uma coluna **COPIE ESTE TOKEN PARA A REGRA DO ERP**.
   Copie o valor. Ele aparece só nessa hora. Rodar o script de novo gera outro
   token e invalida o anterior.

### 2. Regra no ERP
1. No ERP, abra **Recursos → Implementações → Regras** e cadastre uma regra nova
   (ex.: "ELO - Envio de clientes ao painel").
2. Cole o conteúdo de `regra-envio-clientes.lsp`.
3. Troque `COLE_O_TOKEN_AQUI` pelo token do passo 1 e salve.
4. Execute em **Recursos → Implementações → Regras → Executar** (tela F000ERG),
   informando o código da regra.
5. A mensagem final mostra quantos clientes foram enviados, ou o erro HTTP.

### 3. Agendar
Em **Recursos → Processos Automáticos → Cadastro** (tela F000AGE), cadastre um
processo que execute essa regra, por exemplo toda noite. Os logs ficam em
**Processos Automáticos → Consulta Logs** (F000LPA).

## Formato enviado

Texto puro, em windows-1252 (padrão do `HttpPost` do ERP):

```
ELO1~codcli|nomcli|apecli|tipcli|cgccpf|cidcli|sigufs|foncli|intnet|sitcli~...
```

Lotes de 200 registros. O servidor aceita até 1000 por lote.

## O que é gravado

- Chave: `clientes.codigo_senior` (= `E085CLI.CODCLI`).
- Atualiza: nome, fantasia, CNPJ/CPF, cidade, UF, telefone, e-mail e situação.
- **Não mexe** em responsável, segmento, região e observações do comercial.
- Cliente cadastrado à mão com o mesmo CNPJ ganha o código do ERP (não duplica).

## Respostas do endpoint

| HTTP | Significado |
|---|---|
| 200 | `{ ok, recebidos, gravados, ignorados }` |
| 400 | corpo fora do formato `ELO1` ou lote grande demais |
| 401 | token ausente ou inválido |
| 500 | falha ao gravar no banco (ver logs da Vercel) |

## A validar no primeiro uso

- **Nomes das colunas da E085CLI** (`CODCLI`, `NOMCLI`, `APECLI`, `TIPCLI`,
  `CGCCPF`, `CIDCLI`, `SIGUFS`, `FONCLI`, `INTNET`, `SITCLI`): são os campos
  padrão do cadastro de clientes, mas se a regra acusar coluna inexistente,
  ajuste o SELECT.
- **SQL nativo**: a regra usa `SQL_UsarSQLSenior2(..., 0)` e `CAST(... AS VARCHAR(20))`,
  que funciona em SQL Server e Oracle.
- **Saída HTTPS da regra**: o teste do Chrome indica que o servidor sai para a
  internet, mas a regra pode rodar em outro processo. Se der erro de conexão,
  verifique proxy em Central de Configurações → Internet (o `HttpObjeto` usa
  essas configurações).

Referências (reformulado para conformidade de licença):
- Funções HTTP em regras: https://documentacao.senior.com.br/tecnologia/5.10.4/lsp/funcoes/requisicoes-http.htm
- Funções SQL em regras: https://documentacao.senior.com.br/tecnologia/5.10.4/lsp/funcoes/sql-em-regra.html
- Executar regra (F000ERG): https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/menu_recursos/f000erg.htm
- Processos automáticos (F000AGE): https://documentacao.senior.com.br/goup/5.10.3/menu_recursos/f000age.htm
