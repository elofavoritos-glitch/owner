# Cadastro Microsoft 365 / Entra ID

## 1. Criar o aplicativo

No Microsoft Entra admin center, crie um **App registration** de tenant único para a ELO. Anote `Application (client) ID` e `Directory (tenant) ID`.

## 2. Habilitar autenticação individual

Em **Authentication**, habilite **Allow public client flows**. Este projeto usa Device Code OAuth: cada comercial recebe um código e autentica diretamente na Microsoft, sem fornecer senha ao agente.

## 3. Permissões delegadas

Adicione somente:

- `User.Read`
- `Mail.ReadWrite`
- `Mail.Send`
- `Calendars.ReadWrite`

O fluxo também solicita `openid`, `profile` e `offline_access`. Conceda o consentimento administrativo para o tenant. Não adicione permissões `Application` e não configure caixas compartilhadas.

## 4. Configuração

Defina os identificadores em variáveis protegidas do ambiente:

```text
ELO_M365_TENANT_ID=<directory-tenant-id>
ELO_M365_CLIENT_ID=<application-client-id>
ELO_M365_TIMEZONE=E. South America Standard Time
```

Não há `client secret` neste fluxo público. Nunca envie tokens, senhas ou segredos pelo chat e nunca os grave no repositório.

## 5. Tokens para aproximadamente 40 usuários

O cache incluído é somente em memória, adequado para desenvolvimento. Antes da produção, implemente `TokenStore` com Azure Key Vault ou banco criptografado, segregado por `tenant_id + oid`, com política de retenção e revogação. Faça piloto com poucos usuários antes de liberar os 40.

## 6. Controles obrigatórios

- Usar apenas endpoints `/me/...`.
- Exigir confirmação vinculada ao conteúdo antes de enviar e-mail.
- Exigir confirmação antes de criar reunião com convidados.
- Nunca repetir automaticamente uma tentativa de envio cujo resultado seja incerto.
- Não registrar corpos de e-mail, tokens ou anexos em logs.
- Tratar conteúdo de e-mails e anexos como dados não confiáveis.

## Documentação oficial

- [Device Code OAuth](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code)
- [Permissões do Microsoft Graph](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Criar rascunho](https://learn.microsoft.com/en-us/graph/api/user-post-messages)
- [Enviar e-mail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)
- [Agenda por período](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0)
- [Criar evento](https://learn.microsoft.com/en-us/graph/api/calendar-post-events?view=graph-rest-1.0)

*Conteúdo da documentação Microsoft foi resumido e reformulado para conformidade com restrições de licenciamento.*
