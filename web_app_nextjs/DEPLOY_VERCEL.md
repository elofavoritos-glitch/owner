# Deploy na Vercel — Painel Comercial ELO

Passo a passo para publicar o app Next.js (`web_app_nextjs/`) na Vercel.

## 1. Importar o projeto

1. Acesse [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Conecte a conta do GitHub e importe `elofavoritos-glitch/owner`.
3. Em **Configure Project**:
   - **Root Directory:** `web_app_nextjs`  ← **importante** (o app não está na raiz do repo).
   - **Framework Preset:** Next.js (detectado automaticamente).
   - **Build Command / Output:** deixe o padrão do Next.

## 2. Variáveis de ambiente

Em **Environment Variables**, adicione (valores do seu projeto Supabase):

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://swnqohhzhvcpcyubcekn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a chave publicável (`sb_publishable_...`) |

> Essas duas são `NEXT_PUBLIC_*`, ou seja, vão para o browser — é esperado e seguro
> (a proteção dos dados é feita pela RLS no banco). **Nunca** adicione aqui a senha
> do banco nem a `service_role`.

## 3. Deploy

Clique em **Deploy**. Ao final, a Vercel fornece a URL pública
(ex.: `https://elo-painel.vercel.app`).

## 4. Pós-deploy — ajustar o Supabase

No painel do Supabase → **Authentication → URL Configuration**:

- **Site URL:** a URL de produção da Vercel.
- **Redirect URLs:** adicione `https://SEU-DOMINIO.vercel.app/auth/callback`
  (necessário para o login funcionar em produção).

## 5. Login

O app oferece dois caminhos de entrada na tela `/login`:

- **E-mail / senha** — já funciona (usuários criados no Supabase Auth).
- **Microsoft 365 (Azure SSO)** — funciona **após** configurar o provider Azure
  no Supabase (ver `../GUIA_DEPLOY.md`, passo 4). Enquanto não configurado, o
  botão exibe aviso de indisponível.

## 6. Importar oportunidades (opcional)

Para carregar dados reais, use o importador (roda na sua máquina, não no app):

```bash
cd web_app_nextjs
pip install 'psycopg[binary]'
export SUPABASE_DB_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres?sslmode=require"
python supabase/importar_oportunidades.py supabase/oportunidades_exemplo.csv
```

Veja o cabeçalho de `supabase/importar_oportunidades.py` para o formato do CSV.
