-- Base de conhecimento comercial do assistente (procedimentos/processos/respostas).
-- Alimentada pela sincronização com o SharePoint (/api/sharepoint/sync) ou
-- manualmente. O assistente carrega 'procedimentos-comerciais' no SYSTEM_PROMPT.

create table if not exists conhecimento_comercial (
  id            text primary key,              -- ex.: 'procedimentos-comerciais'
  fonte         text,                           -- origem (ex.: 'SharePoint: COMERCIAL/...')
  conteudo      text not null,                  -- texto extraído (markdown)
  arquivos      text[],                         -- nomes dos arquivos sincronizados
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);

alter table conhecimento_comercial enable row level security;

-- Leitura: qualquer usuário autenticado (o assistente usa no servidor).
drop policy if exists conhecimento_read on conhecimento_comercial;
create policy conhecimento_read on conhecimento_comercial
  for select using (auth.uid() is not null);

-- Escrita (upsert): apenas gestor/admin (a rota /sync também valida o papel).
drop policy if exists conhecimento_write on conhecimento_comercial;
create policy conhecimento_write on conhecimento_comercial
  for all using (papel_atual() in ('gestor','admin'))
  with check (papel_atual() in ('gestor','admin'));
