-- Evolução do cadastro de clientes (Etapa 1 do módulo de clientes/documentos).
-- A tabela `clientes` já existia no schema base; aqui adicionamos campos úteis
-- ao comercial e as políticas de RLS (que faltavam para insert/update).

alter table clientes add column if not exists telefone text;
alter table clientes add column if not exists segmento text;
alter table clientes add column if not exists cidade text;
alter table clientes add column if not exists uf text;
alter table clientes add column if not exists responsavel_id uuid references perfis(id) on delete set null;
alter table clientes add column if not exists responsavel_nome text;
alter table clientes add column if not exists observacoes text;
alter table clientes add column if not exists atualizado_em timestamptz default now();

create index if not exists idx_clientes_empresa on clientes (lower(empresa));
create index if not exists idx_clientes_cnpj on clientes (cnpj);

-- RLS: a tabela base só tinha policy de SELECT (clientes_auth_read).
-- Base compartilhada: todos autenticados leem; comercial cria/edita; gestor/admin
-- têm controle total.
alter table clientes enable row level security;

drop policy if exists clientes_insert on clientes;
create policy clientes_insert on clientes for insert with check (auth.uid() is not null);

drop policy if exists clientes_update on clientes;
create policy clientes_update on clientes for update using (auth.uid() is not null);
