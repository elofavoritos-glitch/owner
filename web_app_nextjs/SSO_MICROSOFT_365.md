# Login SSO com Microsoft 365 (web app)

Este guia é **só para o login SSO do painel web** (botão "Entrar com Microsoft 365").
É diferente do `outlook_agent/ENTRA_SETUP.md`, que trata do agente de e-mail em
Python (fluxo Device Code). Aqui usamos o fluxo **OAuth web** do Supabase, que
exige um **client secret** e uma **redirect URI**.

> O código do app já está 100% pronto: botão em `app/login/page.tsx` e callback em
> `app/auth/callback/route.ts`. Falta apenas **configuração** (Entra + Supabase).

## Dados do projeto

| Item | Valor |
|---|---|
| Client ID (Application ID) | `09d87a55-cf0f-4bf0-9703-7759acb1451a` |
| Tenant ID (Directory ID) | `3073b3c6-1050-4d2e-a59d-4e32f50ac3b5` |
| Redirect URI (Supabase callback) | `https://swnqohhzhvcpcyubcekn.supabase.co/auth/v1/callback` |
| Projeto Supabase | `swnqohhzhvcpcyubcekn` |

---

## Passo 1 — Microsoft Entra (portal.azure.com)

O App registration já existe (Client ID acima). Falta garantir 2 coisas:

### 1a. Redirect URI
1. `portal.azure.com` → **Microsoft Entra ID** → **App registrations** → selecione o app.
2. Menu lateral → **Authentication**.
3. Em **Platform configurations**, confirme que existe uma plataforma **Web** com a
   Redirect URI exatamente igual a:
   ```
   https://swnqohhzhvcpcyubcekn.supabase.co/auth/v1/callback
   ```
   Se não existir, clique **Add a platform → Web** e cole essa URL.

### 1b. Client secret (ESTE é o que falta criar)
1. No mesmo app → menu lateral → **Certificates & secrets**.
2. Aba **Client secrets** → **New client secret**.
3. Dê um nome (ex.: `supabase-sso`) e escolha a validade (ex.: 24 meses — anote a
   data de expiração na agenda para renovar antes de vencer).
4. Clique **Add**.
5. **COPIE O VALOR da coluna "Value"** (NÃO o "Secret ID"). Ele só aparece uma vez.
   É um texto tipo `abC8Q~xxxxxxxxxxxxxxxxxxxxxxxxxxxx`.

> ⚠️ Nunca cole esse secret aqui no chat. Ele vai direto no painel do Supabase.

---

## Passo 2 — Supabase (ligar o provider Azure)

### Onde fica (o que travou antes)
Atalho direto (navegador já logado no Supabase):
```
https://supabase.com/dashboard/project/swnqohhzhvcpcyubcekn/auth/providers
```
Ou pelo menu: **Authentication** → **Sign In / Providers** → aba **Social** →
role até **Azure** e clique para expandir.

### O que preencher no accordion "Azure"
1. Ligue a chave **Enable Sign in with Azure** (toggle no topo).
2. **Application (client) ID** → `09d87a55-cf0f-4bf0-9703-7759acb1451a`

   > ⚠️ **PEGADINHA COMUM:** cole exatamente esse UUID. NÃO cole o *nome do
   > projeto* (ex.: `elofavoritos-glitch's Project`) nem o nome do app do Entra.
   > O Client ID é sempre um UUID no formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
   > Se colar o nome em vez do UUID, a Microsoft rejeita o login com erro
   > `AADSTS700016` ("application not found"). Para conferir o que ficou salvo,
   > veja a seção "Como verificar o que está salvo" abaixo.
3. **Secret Value** → cole o VALUE do client secret criado no Passo 1b.
4. **Azure Tenant URL** → como o app é single-tenant (só a ELO), preencha:
   ```
   https://login.microsoftonline.com/3073b3c6-1050-4d2e-a59d-4e32f50ac3b5
   ```
5. Clique **Save**.

### Confirme a Redirect URL do Supabase
Ainda em Authentication → **URL Configuration**:
- **Site URL**: `https://owner-webappnextjs.vercel.app`
- Em **Redirect URLs**, inclua:
  ```
  https://owner-webappnextjs.vercel.app/**
  ```

---

## Passo 3 — Testar

1. Abra `https://owner-webappnextjs.vercel.app/login`.
2. Clique **Entrar com Microsoft 365**.
3. Deve redirecionar para a tela da Microsoft, pedir login/consentimento e
   voltar para o painel autenticado.

Se der erro, veja a seção abaixo.

---

## Como verificar o que está salvo (sem acessar o painel)

Dá para conferir se o provider está ligado e qual `client_id` o Supabase está
realmente usando, batendo nos endpoints públicos de auth do projeto:

```bash
# 1) O provider azure está habilitado?  (procure por "azure":true)
curl -s "https://swnqohhzhvcpcyubcekn.supabase.co/auth/v1/settings" \
  -H "apikey: <ANON_KEY>"

# 2) Qual client_id vai pra Microsoft?  (-I = só headers; veja o Location)
curl -sI "https://swnqohhzhvcpcyubcekn.supabase.co/auth/v1/authorize?provider=azure&redirect_to=https://owner-webappnextjs.vercel.app/auth/callback"
```

No `Location` do passo 2, o parâmetro `client_id` DEVE ser o UUID
`09d87a55-cf0f-4bf0-9703-7759acb1451a`. Se aparecer o nome do projeto ali,
o campo Client ID no Supabase está errado (veja a pegadinha do Passo 2).

---

## Erros comuns

| Erro | Causa provável | Correção |
|---|---|---|
| "provider is not enabled" | Provider Azure não salvo no Supabase | Passo 2 |
| "redirect_uri_mismatch" (tela MS) | Redirect URI não bate no Entra | Passo 1a — URL idêntica |
| "AADSTS7000215: Invalid client secret" | Secret errado/expirado, ou colou o Secret ID em vez do Value | Passo 1b — copiar a coluna Value |
| "AADSTS700016: application not found" | Colou o NOME do projeto no campo Client ID em vez do UUID | Passo 2 — colar o UUID `09d87a55-...` |
| Volta ao /login sem logar | Site URL / Redirect URLs do Supabase | Passo 2 (URL Configuration) |
| "AADSTS50011" | Redirect não autorizado no Entra | Passo 1a |

*Instruções de UI do Supabase/Azure resumidas e reformuladas das documentações
oficiais ([Supabase: Sign in with Azure](https://supabase.com/docs/guides/auth/social-login/auth-azure)).
Conteúdo reformulado para conformidade com restrições de licenciamento.*
