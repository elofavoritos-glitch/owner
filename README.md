# Agente Comercial — ELO Soluções Logísticas Integradas

Assistente de inteligência e capitalização comercial para uma empresa de logística
(armazenagem e transporte rodoviário), em Itajaí/SC. Não inventa dados, diferencia
dado confirmado de estimativa e exige confirmação humana para efeitos externos
(envio de e-mail, criação de reunião).

## Onde está o produto

| Pasta | O que é |
|---|---|
| **`web_app_nextjs/`** | **O produto vivo.** App Next.js com o assistente (LLM + function-calling), as ferramentas e o conhecimento do Senior ERP. É o que roda em produção. |
| `docs/` | Documentação de apoio (ex.: `docs/senior-erp-relatorios/` — especificações de relatórios `.GER` do Senior ERP). |
| `legacy/` | Referência histórica. Suíte Python multi-agente original e as políticas `elo-*.md` que **deram origem** ao app. Não é executada em runtime — veja `legacy/README.md`. |

> O coração do assistente é `web_app_nextjs/lib/elo-agent.ts` (prompt + catálogo de
> ferramentas) e `web_app_nextjs/app/api/chat/route.ts` (execução das ferramentas).

## O que o assistente faz

Multifuncional, via ferramentas (function-calling) e conhecimento embutido:

- **Inteligência comercial** — descoberta, score, dossiê e diagnóstico de leads.
- **Prospecção** — Econodata (dimensionar mercado, prospectar, decisores, match, custo) e Comex/Logcomex.
- **Documentos** — propostas em PDF e apresentações em PPTX com a identidade da ELO.
- **Logística** — clima, aeroportos e cálculo de rota.
- **Produtividade** — briefing do dia, registro de interações, tradução, qualificação de lead.
- **Senior Gestão Empresarial | ERP (v5.10.4)** — apoio a operação, parametrização,
  fiscal/contábil, integrações, customização (**Regras/LSP**) e **Gerador de Relatórios/.GER**.

## Princípios

- Nunca inventar CNPJ, preço, prazo, volume, capacidade ou condição.
- Diferenciar dado confirmado, estimativa e pendência.
- Envio de e-mail e criação de reunião só após confirmação humana.
- Segredos (chaves/tokens) ficam em variáveis de ambiente/Secrets, nunca no código
  (ver `web_app_nextjs/SEGURANCA_PENDENCIAS.md`).

## Começar

Veja `web_app_nextjs/README.md` para desenvolvimento e `GUIA_DEPLOY.md` para deploy.
