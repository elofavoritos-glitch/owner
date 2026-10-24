# Integração SharePoint → Assistente (Microsoft Graph, app-only)

Puxa os **procedimentos comerciais** do SharePoint da ELO e os injeta na base de
conhecimento do assistente (`conhecimento_comercial`), que é carregada no
SYSTEM_PROMPT. Assim o assistente responde conforme os processos oficiais.

É diferente do **SSO de login** (`SSO_MICROSOFT_365.md`): aquele autentica
*usuários*; este é um acesso **app-only** (a aplicação lê arquivos sem um usuário
logado), via fluxo *client credentials*.

## Visão geral do fluxo
1. App registration no Entra com permissão **Sites.Read.All** (Application) + consentimento de admin.
2. Client secret desse app.
3. Variáveis de ambiente na Vercel.
4. Aplicar a migration `supabase/conhecimento.sql`.
5. Gestor/admin dispara a sincronização (`POST /api/sharepoint/sync`).

---

## Passo 1 — Entra (portal.azure.com) — VOCÊ é admin, então pode fazer

Pode reutilizar o app do SSO ou criar um dedicado (recomendado separar):
1. **Microsoft Entra ID → App registrations → New registration** (nome ex.: `elo-painel-sharepoint`). Single tenant.
2. Anote **Application (client) ID** e **Directory (tenant) ID**.
3. Menu **API permissions → Add a permission → Microsoft Graph → Application permissions**:
   - adicione **`Sites.Read.All`** (ou `Sites.Selected` para restringir a sites específicos — mais seguro, porém exige conceder o site via Graph).
4. Clique em **Grant admin consent for ELO** (precisa de admin — você tem).
5. Menu **Certificates & secrets → New client secret** → copie o **Value** (não o Secret ID).

> `Sites.Read.All` dá leitura a todos os sites. Para o mínimo privilégio, use
> `Sites.Selected` e conceda só o site DEPARTAMENTOS — posso ajustar a integração
> para esse modo se preferir.

---

## Passo 2 — Variáveis de ambiente (Vercel → Settings → Environment Variables)

```
ELO_GRAPH_TENANT_ID       = <Directory (tenant) ID>
ELO_GRAPH_CLIENT_ID       = <Application (client) ID do app sharepoint>
ELO_GRAPH_CLIENT_SECRET   = <Value do client secret>
ELO_SHAREPOINT_HOST       = intranetelo.sharepoint.com
ELO_SHAREPOINT_SITE_PATH  = /sites/DEPARTAMENTOS
```

Depois, **Redeploy**.

> Como descobrir o SITE_PATH: na URL do SharePoint, é o trecho depois do host até
> o nome do site. No seu link, o site é `/sites/DEPARTAMENTOS` e a pasta de
> procedimentos fica dentro dele (ex.: `COMERCIAL/PROCEDIMENTOS COMERCIAIS`).

---

## Passo 3 — Banco (Supabase)

Aplique a migration uma vez:
```
supabase/conhecimento.sql
```
(cria a tabela `conhecimento_comercial` com RLS: leitura para autenticados,
escrita só para gestor/admin.)

---

## Passo 4 — Sincronizar

Autenticado como **gestor/admin**:
```bash
curl -X POST https://owner-webappnextjs.vercel.app/api/sharepoint/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão>" \
  -d '{"pasta":"COMERCIAL/PROCEDIMENTOS COMERCIAIS"}'
```
Retorna os arquivos extraídos e os ignorados. Depois disso, o assistente já
responde usando os procedimentos.

Ver o que está sincronizado: `GET /api/sharepoint/sync`.

### Formatos suportados na extração
- ✅ `.docx`, `.txt`, `.md`, `.csv`, `.json` → texto extraído automaticamente.
- ⚠️ `.pdf`, `.doc` (antigo), `.xlsx`, `.pptx` → **não** extraídos aqui. Converta
  para `.docx`/`.txt`/`.md` no SharePoint, ou cole o conteúdo manualmente.

---

## Erros comuns
| Erro | Causa | Correção |
|---|---|---|
| "Integração SharePoint não configurada" | Faltam env vars | Passo 2 |
| "Falha ao autenticar no Graph (invalid_client)" | Client secret errado/expirado | Passo 1.5 |
| "Site não encontrado" | SITE_PATH errado | Confira o trecho `/sites/...` da URL |
| 403 ao autenticar / sem dados | Falta **Grant admin consent** ou a permissão Sites.Read.All | Passo 1.3–1.4 |
| "Pasta não encontrada" | Caminho da pasta diferente | Ajuste o `pasta` no POST |

*Instruções resumidas da documentação oficial do Microsoft Graph
(learn.microsoft.com/graph). Conteúdo reformulado para conformidade.*
