# Econodata na ELO — dois caminhos de integração

A API v4 da Econodata (`https://api.econodata.com.br/v4`) traz dados de empresas
brasileiras para **prospecção, enriquecimento e inteligência comercial** — o
público-alvo da ELO para armazenagem e transporte.

Há **dois caminhos de uso**, e a ELO usa os dois:

| | **1. REST — no painel da ELO** | **2. MCP — no Claude Code pessoal** |
|---|---|---|
| Para quem | Todo o time comercial, dentro do app | Cada pessoa, no seu Claude/ChatGPT |
| Como entra | Chave `ek_live_...` na Vercel | Login OAuth (sem digitar chave) |
| Onde roda | Servidor do painel (Next.js) | Máquina do usuário |
| O que ativa | 6 ferramentas no assistente do painel | Econodata em linguagem natural no seu assistente |

Os dois consomem **tokens** da mesma conta e exigem **API v4 liberada** (trial
não acessa o MCP, e no REST fica só-leitura).

---

## Caminho 1 — REST (já integrado ao painel)

### O que o time pode pedir ao assistente do painel
- *"quantas indústrias de alimentos ativas tem em SC com mais de 50 funcionários?"* → conta o mercado (TAM)
- *"me traz empresas de logística no PR, porte médio e grande, com telefone"* → lista de leads
- *"consulta o CNPJ 47.960.950/0001-21"* → enriquece a empresa
- *"qual o CNPJ da Cremer em SC?"* → acha a empresa por nome + UF
- *"quem decide na empresa X?"* (por CNPJ) → organograma de decisores
- *"qual o meu saldo na Econodata?"* → saldo de tokens

### Ferramentas (tools) expostas
| Tool | Função | Endpoint Econodata |
|---|---|---|
| `econodata_dimensionar_mercado` | Contagem de um recorte (TAM), barato | `POST /companies/calc_list` |
| `econodata_prospectar` | Lista de leads por filtros (paginada) | `POST /companies/search_list` |
| `econodata_consultar_empresa` | Enriquece 1 empresa (CNPJ/site/e-mail) | `POST /companies/search` |
| `econodata_match` | Descobre a empresa por nome+UF | `POST /companies/match` |
| `econodata_decisores` | Decisores/colaboradores por CNPJ | `GET /companies/{cnpj}/people` |
| `econodata_saldo` | Saldo de tokens (grátis) | `GET /account/balance` |

Código: `lib/econodata.ts` (cliente REST) + tools em `lib/elo-agent.ts` + executor
em `app/api/chat/route.ts`.

### Configuração (única coisa que falta)
Na **Vercel** → projeto → **Settings → Environment Variables**:

```
ELO_ECONODATA_API_KEY = ek_live_...   (chave da conta, API v4 liberada)
```

Gere a chave em `https://plat.econodata.com.br/#/integracoes-api` (**Chaves e
Integrações** → **Criar nova chave** → copie, aparece só uma vez). Depois,
**Redeploy**. Sem a chave, as consultas Econodata respondem "indisponível".

### Teste em produção (depois de colocar a chave)
Pelo assistente: *"qual o meu saldo na Econodata?"* → deve responder um número.
Ou direto na API:

```bash
curl https://api.econodata.com.br/v4/account/balance \
  -H "Authorization: Bearer ek_live_SUA_CHAVE"
# → {"saldoTokens": 9013500}
```

Ou rode o smoke test incluído (saldo → consulta de 1 empresa → contagem de
mercado; gasta o mínimo de tokens, não escreve nada):

```bash
ELO_ECONODATA_API_KEY=ek_live_... node scripts/testar-econodata.mjs
```

---

## Caminho 2 — MCP (Claude Code / Claude / ChatGPT)

O MCP conecta **o seu assistente de IA** direto à Econodata, por **login OAuth**
(a sua senha nunca chega ao assistente). É exclusivo de contas com **API v4
liberada** — trial não conecta.

### Claude Code (terminal) — o comando
```bash
claude mcp add --transport http --scope user econodata-v4 \
  https://api.econodata.com.br/v4/mcp
```
Na primeira vez que usar, abre o navegador para **autorizar com o seu login**.
Depois: rode `/mcp` e confirme `econodata-v4: connected`.

> Se você tinha uma config antiga com `--header "Authorization: Bearer ek_live_..."`,
> remova e reconecte: `claude mcp remove econodata-v4` e rode o comando acima.
> O MCP novo usa OAuth, não precisa mais de header com chave.

### Claude (web/desktop)
Configurações → Conectores → **Adicionar conector personalizado**:
- Nome: `Econodata`
- URL do servidor MCP: `https://api.econodata.com.br/v4/mcp`

Clique **Adicionar** → **Conectar** → autorize na página da Econodata.
(No plano gratuito do Claude só cabe **1** conector personalizado.)

### ChatGPT (Plus/Pro/Business/Enterprise/Edu — não funciona no grátis)
Configurações → Conectores → ative **Developer mode** → **Criar**:
- Nome: `Econodata`
- URL do servidor MCP: `https://api.econodata.com.br/v4/mcp`
- Autenticação: **OAuth**

### Teste (qualquer assistente)
Pergunte: *"qual é o meu saldo de tokens na Econodata?"*. Se vier um número,
está conectado.

### Fluxo OAuth do MCP (confirmado em produção)
O servidor MCP (`POST /v4/mcp`) exige OAuth e expõe a descoberta padrão:
- `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource"`
- `/.well-known/oauth-authorization-server` → `authorize`, `token`, `register`
  (**registro dinâmico de cliente / DCR**), `revoke`; PKCE **S256**.
- Scopes: `companies:read`, `companies:match`, `companies:search_list`,
  `companies:search_list_by_id`, `companies:people`, `companies:economic_group`,
  `companies:unlock`, `tags:write`, `tags:read`, `account:read`.

Como há **DCR**, Claude Code/Claude/ChatGPT se registram sozinhos — **não** é
preciso Client ID/Secret manual (só o Gemini Enterprise exige credenciais
dedicadas, emitidas pela Econodata).

### Nível de inteligência do MCP
O MCP agrega leitura de prospecção em 3 níveis — `baixo` (dado cru), `medio`
(padrão, com interpretação) e `alto` (cruza com notícia/pesquisa de setor). Troque
pedindo em português: *"mude o nível de inteligência da Econodata para alto"*.

---

## Observações importantes
- **Cobrança em tokens** nos dois caminhos; `GET /account/balance` é grátis.
- **Dimensione antes de listar:** `calc_list` conta o recorte sem pagar por
  empresa — o assistente do painel já é orientado a fazer isso.
- **LGPD:** dados de pessoas (decisores) são de uso responsável do controlador;
  CPF de sócio vem mascarado.
- **Rate-limit:** 60 req/min por chave (burst 120).

Documentação oficial: https://econodata-tecnologia.github.io/api-v4-docs/
