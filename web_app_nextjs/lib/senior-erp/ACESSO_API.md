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

## O que o admin do Senior precisa fazer (portal dev.senior.com.br)
Conforme a documentação oficial da Senior (fórum/portal do desenvolvedor):

1. **Criar uma Aplicação** no portal do desenvolvedor / Gerenciamento de Aplicações
   da plataforma → obter o **`client_id`**.
2. **Habilitar na Aplicação** o uso dos serviços/APIs necessários (autenticação e
   as APIs do ERP que o relatório consome) e **liberar a rota** (tirar o
   "route blocked").
3. Enviar o **`client_id`** no header de todas as requisições (o cliente já faz
   isso quando `SENIOR_CLIENT_ID` está definido).
4. **Se o tenant usar autenticação federada (SAML/ADFS)**: o login direto por
   usuário/senha não basta — gerar uma **Chave de Aplicação** (access key +
   secret). O cliente já suporta esse modo (`loginWithKey`).

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
