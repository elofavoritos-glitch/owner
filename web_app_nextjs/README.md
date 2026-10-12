# ELO — Painel Comercial (Next.js + Supabase + Login Microsoft 365)

Versão de produção da plataforma web, para ~40 usuários. Preparada para rodar
**fora do sandbox** (onde há npm e internet). O protótipo sem dependências está
em `../web_dashboard/` e serve para validação visual imediata.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Supabase** (Postgres + Auth) com **RLS**
- **Login Microsoft 365** (OAuth Azure via Supabase Auth)
- **Recharts** para gráficos interativos

## Como rodar (em máquina com internet)

```bash
cd web_app_nextjs
npm install
cp .env.example .env.local   # preencher com as chaves reais (NUNCA comitar)
npm run dev                  # http://localhost:3000
```

## Configuração do banco

1. Crie um projeto no Supabase.
2. Rode `supabase/schema.sql` no SQL Editor (cria tabelas + RLS).
3. Copie `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` para o `.env.local`.

## Login Microsoft 365

1. No Supabase: Authentication → Providers → **Azure** → habilitar.
2. Informe `MS_TENANT_ID`, `MS_CLIENT_ID` e o client secret (reaproveita o app
   registration do Entra já criado para o Outlook, ou crie um dedicado ao web app).
3. Em redirect URIs do Entra, adicione a URL de callback do Supabase.

## Permissões (RLS)

- **Comercial** vê e edita apenas as próprias oportunidades.
- **Gestor/Admin** veem o time todo.
- Definido em `supabase/schema.sql` via políticas e a função `papel_atual()`.

## Estrutura

```
web_app_nextjs/
├── app/
│   ├── layout.tsx          # layout raiz
│   ├── page.tsx            # dashboard (server component, lê do Supabase)
│   ├── charts.tsx          # gráficos Recharts (client)
│   ├── login/page.tsx      # login Microsoft 365
│   └── auth/callback/route.ts
├── lib/
│   ├── supabase.ts         # clientes browser/server
│   └── metrics.ts          # cálculo de indicadores (espelha os agentes Python)
├── supabase/schema.sql     # tabelas + RLS
├── package.json
├── tsconfig.json
└── .env.example
```

## Deploy

- **Vercel** (recomendado): conectar o repositório, definir as variáveis de
  ambiente no painel, deploy automático.
- O `../web_dashboard/` pode ir ao **GitHub Pages** para visualização rápida.

## Integração com os agentes

Os agentes Python (`../*_agent/`) continuam sendo o "motor" de inteligência
(cotação, score, dossiê, geolocalização). A médio prazo, exponha-os como API e
consuma a partir deste app; por ora, o painel lê os dados diretamente do Supabase.
