# Senior ERP — o que falta para liberar o acesso à API (guia para o admin)

> Diagnóstico feito testando a API real do tenant `elo.log.br`. A integração de
> código está **pronta e testada**; faltam passos de **configuração no portal
> Senior** que exigem acesso de administrador.

## O que já funciona ✅
- **Autenticação**: `POST https://api.senior.com.br/platform/authentication/actions/login`
  com `{ username: "intapi@elo.log.br", password: "***" }` → retorna token (HTTP 200).
  - O **username precisa do `@elo.log.br`** (sem isso dá 401).
  - O token vem embrulhado no campo `jsonToken` (o cliente já desembrulha).

## O que está bloqueado 🔒
Toda rota de negócio retorna **HTTP 403 `"Request blocked by the administrator -
route blocked"`** no host `platform.senior.com.br/t/senior.com.br/...` — inclusive
endpoints triviais (ex.: `getLoggedUser`). Ou seja, **o bloqueio é de aplicação/
permissão**, não de endpoint específico. No host `api.senior.com.br` as rotas de
negócio dão `404 "Could not route request"` (host errado para elas).

## ✅ Como liberar — passo a passo oficial (portal XPlatform API)

> Fonte oficial Senior: o erro de rota bloqueada / client_id inválido ocorre
> quando o `client_id` **não tem as APIs liberadas**. A solução é criar o app e
> **marcar as APIs disponíveis**. (reformulado p/ conformidade —
> https://suporte.senior.com.br/hc/pt-br/articles/29792064550676)

1. Acesse o **portal XPlatform API** (`dev.senior.com.br` → portal de APIs) e faça
   **login** com as credenciais da conta Senior da ELO.
2. Clique em **Minha conta**.
3. No menu, vá em **Dev Tools / Minhas Apps**.
4. **Crie um aplicativo** (ou abra um existente) — ele gera o **`client_id`**
   (e, se oferecido, uma **chave de aplicação**: access key + secret).
5. Clique no **nome do aplicativo** e vá na seção **"APIs disponíveis"**.
6. **Selecione as APIs** que o relatório consome (ou todas as disponíveis) e salve.
7. Copie o **`client_id`** do app.

### Se o tenant `elo.log.br` usar autenticação federada (SAML/ADFS)
O login direto por usuário/senha não basta para a API. Nesse caso, no mesmo
gerenciamento de aplicações, gere uma **Chave de Aplicação** (access key +
secret) — o cliente já suporta esse modo (`loginWithKey`).

## Como ligar no código depois de liberado
Definir as variáveis de ambiente (Vercel/Supabase — nunca no repo):

```
SENIOR_API_BASE_URL=https://platform.senior.com.br/t/elo.log.br   # host/padrão do cloud
SENIOR_CLIENT_ID=<client_id da Aplicação>
SENIOR_USERNAME=intapi@elo.log.br
SENIOR_PASSWORD=<senha>                 # OU, se federado:
SENIOR_ACCESS_KEY=<access key>
SENIOR_SECRET=<secret>
```

E rodar o smoke test:
```
node scripts/testar-senior-clientes.mjs
```

## Referências (reformulado p/ conformidade de licença)
- Autenticação da plataforma: https://dev.senior.com.br/autenticacao-na-plataforma/
- "Não consigo realizar login" (fórum oficial, explica client_id e SAML): https://dev.senior.com.br/forums/t%C3%B3pico/nao-consigo-realizar-login/
- Erro client_id inválido: https://suporte.senior.com.br/hc/pt-br/articles/29792064550676
- WS clientes (porta exportar): https://documentacao.senior.com.br/goup/5.10.3/webservices/com_senior_g5_co_cad_clientes.htm
