# Legacy — suíte Python original (referência histórica)

> ⚠️ **Nada aqui é executado em runtime.** O produto vivo é o app Next.js em
> `web_app_nextjs/`. Esta pasta é mantida apenas como **referência de design**: foi
> a primeira implementação do assistente, em Python, cuja lógica já foi **portada
> para TypeScript** dentro de `web_app_nextjs/lib/`.

## Mapa do que foi portado

| Original (aqui) | Equivalente vivo (TypeScript) |
|---|---|
| `powerpoint_agent/` | `web_app_nextjs/lib/apresentacao-pptx.ts` |
| `pdf_agent/` | `web_app_nextjs/lib/proposta-pdf.ts` |
| `excel_agent/` | `web_app_nextjs/lib/planilha.ts` |
| `geo_agent/` | `web_app_nextjs/lib/servicos-externos.ts` |
| `outlook_agent/` | `web_app_nextjs/lib/servicos-externos.ts` (Microsoft Graph) |
| `sales_intelligence_agent/` | `web_app_nextjs/lib/elo-intelligence.ts` (perfil, score, diagnóstico, dossiê) |
| `sales_*_agent/` | ferramentas em `web_app_nextjs/lib/elo-agent.ts` + `app/api/chat/route.ts` |
| `web_dashboard/` | `web_app_nextjs/app/dashboards/` |
| `elo-*.md` (políticas) | `SYSTEM_PROMPT` em `web_app_nextjs/lib/elo-agent.ts` |

## Por que foi mantido e não apagado

- Documenta a intenção de design de cada "especialista".
- Serve de conferência caso algum comportamento precise ser auditado contra a versão original.

Se um dia for confirmado que não há mais nada a aproveitar aqui, esta pasta pode ser
removida com segurança — o histórico permanece no git.
