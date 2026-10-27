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

## ✅ Como liberar — caminho ATUAL (dentro do Senior X web)

> O portal de desenvolvedor antigo (`dev.senior.com.br` → Dev Tools/Minhas Apps)
> está obsoleto. O caminho atual é **dentro do próprio Senior X**, logado como
> admin do tenant. Fonte oficial (reformulado p/ conformidade):
> https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/hcm/integrador-sst/desenvolvedores/ambiente-de-testes-para-homologacao.htm

### Passo 1 — Criar a aplicação e gerar a chave (access_key + secret)
No Senior X (`platform.senior.com.br`), logado com usuário **admin**:
1. Acesse **Tecnologia → Administração → Gerenciamento de aplicações**.
2. Clique em **Nova aplicação** e preencha **Nome** e **Descrição**
   (ex.: nome `integracao-painel-elo`).
3. Ao lado da aplicação criada, clique em **Ações → Gerenciar chaves**.
4. Clique em **Gerar Chave** → gera a **Chave de Acesso** (access_key) e o
   **Secret** (a "senha do token"). **Copie os dois.**

> Essas duas chaves alimentam `SENIOR_ACCESS_KEY` + `SENIOR_SECRET` no nosso
> cliente (modo `loginWithKey`) — dispensa usuário/senha e o portal de dev.

### Passo 2 — Dar permissão à aplicação (libera o "route blocked")
1. Acesse **Tecnologia → Administração → Autorização → Gestão de Papéis**.
2. Selecione o **papel** adequado, abra a aba **Aplicações** e **ative** a
   aplicação criada (e os recursos/APIs do ERP que serão consumidos).

### Se não aparecer o menu "Tecnologia"
O usuário logado não é admin do tenant. Nesse caso, quem tem o papel admin faz
os passos acima, ou abra chamado no suporte (ver CHAMADO_SUPORTE.md).

## Pré-requisito adicional: "proprietária" (licença do WS de clientes)
Além de passar pelo gateway, o web service `com.senior.g5.co.cad.clientes`
exige um **módulo licenciado ("proprietária")** no ERP. Conforme a doc oficial:

| Porta | Proprietária exigida (contém algum) |
|---|---|
| `Exportar` (todos os clientes) | **IPSI, IMCR ou VMAIS** |
| `ConsultarCadastro` | IPSI |
| `ConsultarGeral` | IPSI ou IMCR |

Fonte: https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/pre-requisito-de-proprietaria.htm
Se a conta não tiver ao menos um desses módulos, o WS retorna erro de licença —
verificar com o distribuidor/Senior. Obs.: esse erro só aparece **depois** de
passar pelo gateway (criar o app + liberar APIs); hoje o bloqueio é o gateway.

## Ordem dos obstáculos (mapa)
1. Autenticar — ✅ OK (token).
2. **Gateway: app + client_id com APIs liberadas** — 🔒 bloqueio atual (403 route blocked).
3. Proprietária/licença do WS (IPSI/IMCR/VMAIS) — ⏳ só valida após o passo 2.

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
