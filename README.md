# Agente Comercial — ELO Soluções Logísticas Integradas

Conjunto de agentes especializados para apoiar o time comercial de uma empresa de
logística (armazenagem e transporte rodoviário), em Itajaí/SC. Tudo funciona
offline por padrão, não inventa dados e exige confirmação humana para efeitos
externos (envio de e-mail, criação de reunião).

## Especialistas

| Especialista | Pasta | O que faz |
|---|---|---|
| Word | `word_agent/` | Propostas, cartas, escopos e documentos `.docx` |
| Excel | `excel_agent/` | Cotações, funil e indicadores `.xlsx` |
| PowerPoint | `powerpoint_agent/` | Apresentações `.pptx` |
| PDF | `pdf_agent/` | Propostas e documentos finais `.pdf` |
| Outlook 365 | `outlook_agent/` | Leitura, resumo diário, agenda, rascunho e reunião (Microsoft Graph) |
| Inteligência comercial | `sales_intelligence_agent/` | Descoberta, score, dossiê e proposta a partir do dossiê |
| Ferramentas de vendas | `sales_tools_agent/` | Cotação de frete, dimensionamento, agenda, follow-up, reativação |
| Conversão | `sales_conversion_agent/` | Qualificação BANT/SPIN, objeções, venda cruzada, ata |
| Geolocalização | `geo_agent/` | Rotas, distâncias e proximidade dos portos (openrouteservice) |
| Gestão | `sales_management_agent/` | Painel do gestor, metas/ranking, distribuição de leads |
| Operações | `sales_ops_agent/` | Transcrição de notas para o funil, capacidade de armazém |

As políticas de cada agente estão nos arquivos `elo-*.md` na raiz. O agente
orquestrador é `elo-comercial-integrado.md`.

## Princípios

- Nunca inventar CNPJ, preço, prazo, volume, capacidade ou condição.
- Diferenciar dado confirmado, estimativa e pendência.
- Usar apenas a conta/caixa do próprio comercial (Outlook `/me`).
- Envio de e-mail e criação de reunião só após confirmação humana.
- Segredos (chaves/tokens) ficam em variáveis de ambiente/Secrets, nunca no código.

## Integrações que exigem credencial

- **Microsoft 365 (Outlook):** `ELO_M365_TENANT_ID`, `ELO_M365_CLIENT_ID`.
- **openrouteservice (geo):** `ELO_ORS_API_KEY`.
- **Logcomex / Econodata:** conectores preparados em `sales_intelligence_agent/connectors/` (ativar quando houver contrato).

## Requisitos

- Python 3 (biblioteca padrão; sem dependências externas obrigatórias).
