# Guia de Ativação e Deploy — Painel Comercial ELO

Passo a passo para colocar o painel no ar e habilitar as integrações. Siga na
ordem. Itens marcados com 🧑 dependem de você (interface/credenciais); os
marcados com 🤖 eu executo quando a rede estiver liberada numa **nova sessão**.

---

## 1. Liberar a internet do sandbox 🧑

**Settings → Agent → Sandbox → Internet access**

- Escolha **Common dependencies** (instala npm/pip) **ou** **Open internet** (tudo).
- Se escolher Common dependencies, adicione na **allow-list customizada**:
  ```
  api.openrouteservice.org, login.microsoftonline.com, graph.microsoft.com
  ```
- **Salve e abra uma NOVA cloud session.** A mudança não vale na sessão atual.

> Sem este passo, `npm install` e as APIs externas não funcionam.

---

## 2. Rodar o app Next.js 🤖 (na sessão nova)

Peça: **"instalar e rodar o app Next.js"**. Eu executo:
```bash
cd web_app_nextjs
npm install
npm run build      # valida a compilação
npm run dev        # sobe em http://localhost:3000
```

---

## 3. Configurar o Supabase 🧑

1. Crie um projeto em supabase.com.
2. SQL Editor → cole e rode `web_app_nextjs/supabase/schema.sql` (cria tabelas + RLS).
3. Settings → API → copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Cole essas duas variáveis como **Secrets** do sandbox (ou no `.env.local`,
   que NÃO é versionado).

---

## 4. Login Microsoft 365 (SSO) 🧑

1. Supabase → Authentication → Providers → **Azure** → habilitar.
2. Informe:
   - Tenant ID: `3073b3c6-1050-4d2e-a59d-4e32f50ac3b5`
   - Client ID: use o app do Entra já criado (ou um dedicado ao web app)
   - Client Secret: gere no Entra (App registration → Certificates & secrets) e
     cole **no Supabase**, nunca no repositório.
3. No Entra, em **Redirect URIs**, adicione a URL de callback do Supabase
   (algo como `https://SEU-PROJETO.supabase.co/auth/v1/callback`).

---

## 5. Popular dados reais 🧑🤖

- Opção rápida: eu gero um importador que lê sua planilha/CSV de oportunidades
  e insere no Supabase (peça **"criar importador de oportunidades"**).
- Enquanto não houver dados reais, o painel usa os dados de demonstração.

---

## 6. Deploy na Vercel 🧑 (recomendado)

1. vercel.com → New Project → importe o repositório `elofavoritos-glitch/owner`.
2. **Root Directory:** `web_app_nextjs`.
3. Em Environment Variables, adicione as mesmas chaves do `.env.example`.
4. Deploy. A Vercel fornece a URL pública (ex.: `elo-painel.vercel.app`).

---

## 7. GitHub Pages (protótipo rápido) 🧑

Para publicar o protótipo sem build (`web_dashboard/`):

1. Repositório → **Settings → Pages**.
2. Source: branch **main**, pasta **/ (root)** → Save.
3. Acesse: `https://elofavoritos-glitch.github.io/owner/web_dashboard/`

> O protótipo usa dados embutidos (`data.js`), então abre sem servidor.

---

## 8. Segurança — pendências 🧑

- **Revogar a chave do openrouteservice** que foi exposta no chat e gerar outra.
- Guardar TODAS as credenciais em Secrets/variáveis do provedor, nunca no código.
- Conferir que o `.gitignore` cobre `.env`, `.env.local`, `node_modules`, `.next`.

---

## Resumo do que roda sem internet (já funciona hoje)

- Todos os agentes Python (`*_agent/`): Word, Excel, PPTX, PDF, inteligência,
  vendas, conversão, gestão, operações.
- Protótipo do dashboard (`web_dashboard/`): abre no navegador com dados de demo.

## O que exige a rede liberada

- `npm install` do app Next.js (web_app_nextjs).
- APIs externas: openrouteservice (geo), Microsoft Graph (Outlook ao vivo).
