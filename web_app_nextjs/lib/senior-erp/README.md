# Integração Senior X (Senior Cloud / Gestão Empresarial | ERP)

Cliente REST para a **Plataforma Senior X**. O ambiente da ELO é **cloud**, então
a integração é **REST + token** (não os web services SOAP do ERP on-premise).

## Como funciona (conforme a doc oficial da Senior)

1. **Autenticação servidor-a-servidor** via **Chave de Aplicação** (access key +
   secret) usando a primitiva **`loginWithKey`**, que devolve um **token**.
2. O token é enviado no header **`Authorization`** em todas as chamadas de API e
   tem validade de alguns dias; ao expirar/falhar, é renovado com a chave.

> Conteúdo reformulado para conformidade de licença. Referências:
> - https://dev.senior.com.br/autenticacao-na-plataforma/
> - https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/vendas/integracao-pedido-venda-api.htm

## Arquivos

| Arquivo | Papel |
|---|---|
| `client.ts` | `SeniorClient`: `autenticar()` (com cache de token) e `chamar()` (injeta token, renova em 401). Config lida de env vars. |
| `client.test.ts` | Testes com `fetch` mockado — não dependem de credencial real. |
| `../../scripts/testar-senior.mjs` | Smoke test de autenticação (só valida o `loginWithKey`). |

## Variáveis de ambiente

| Variável | Obrigatória | Default |
|---|---|---|
| `SENIOR_ACCESS_KEY` | ✅ | — |
| `SENIOR_SECRET` | ✅ | — |
| `SENIOR_TENANT` | ✅ | — |
| `SENIOR_API_BASE_URL` | — | `https://api.senior.com.br` |
| `SENIOR_AUTH_PATH` | — | `/platform/authentication/actions/loginWithKey` |

🔒 Credenciais são **segredos**: só em variáveis de ambiente (Vercel/Supabase),
nunca no repositório.

## Testar a conexão

```bash
SENIOR_ACCESS_KEY=... SENIOR_SECRET=... SENIOR_TENANT=suaempresa.com.br \
  node scripts/testar-senior.mjs
```

O script autentica e informa se o token veio (mascarado — nunca imprime o
segredo nem o token completo).

## ⚠️ A confirmar no ambiente/doc do tenant

Por honestidade técnica (e seguindo a regra de **não inventar endpoints**): o
**path exato** do `loginWithKey` e das APIs de negócio do ERP pode variar por
tenant. Se o smoke test retornar **404**, ajuste `SENIOR_AUTH_PATH` conforme a
documentação/ambiente de vocês. As próximas tools (ex.: consultar produto/pedido)
só devem ser construídas após o smoke test passar com credenciais reais.
