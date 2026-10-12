-- Schema do painel comercial da ELO (Supabase / Postgres)
-- Multiusuário: ~40 comerciais + gestores. RLS garante que o comercial vê a
-- própria carteira e o gestor vê o time.

-- Perfis (vinculados ao auth.users do Supabase, populados via SSO Microsoft)
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text unique not null,
  papel text not null default 'comercial' check (papel in ('comercial','gestor','admin')),
  criado_em timestamptz default now()
);

-- Clientes
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  cnpj text,
  contato text,
  email text,
  regiao text,
  criado_em timestamptz default now()
);

-- Oportunidades (funil)
create table if not exists oportunidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  cliente_nome text not null,
  responsavel_id uuid references perfis(id) on delete set null,
  responsavel_nome text,
  servico text,
  etapa text not null default 'Prospecção'
    check (etapa in ('Prospecção','Qualificação','Diagnóstico','Cotação','Negociação','Ganho','Perdido')),
  status text not null default 'Ativa'
    check (status in ('Ativa','Em espera','Ganha','Perdida')),
  valor_potencial numeric(14,2) default 0,
  probabilidade numeric(4,3) default 0 check (probabilidade between 0 and 1),
  ultimo_contato date,
  proxima_acao text,
  data_proxima_acao date,
  previsao_fechamento date,
  motivo_perda text,
  observacoes text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Metas mensais por vendedor
create table if not exists metas (
  id uuid primary key default gen_random_uuid(),
  responsavel_id uuid references perfis(id) on delete cascade,
  mes_referencia date not null,
  valor_meta numeric(14,2) not null,
  unique (responsavel_id, mes_referencia)
);

-- Atividades (produtividade: ligações, reuniões, propostas)
create table if not exists atividades (
  id uuid primary key default gen_random_uuid(),
  responsavel_id uuid references perfis(id) on delete cascade,
  oportunidade_id uuid references oportunidades(id) on delete set null,
  tipo text not null check (tipo in ('ligacao','reuniao','proposta','email','follow_up')),
  data date not null default current_date,
  observacao text
);

-- Índices úteis
create index if not exists idx_op_responsavel on oportunidades(responsavel_id);
create index if not exists idx_op_etapa on oportunidades(etapa);
create index if not exists idx_ativ_responsavel on atividades(responsavel_id);

-- ===================== RLS (Row Level Security) =====================
alter table perfis enable row level security;
alter table clientes enable row level security;
alter table oportunidades enable row level security;
alter table metas enable row level security;
alter table atividades enable row level security;

-- Helper: papel do usuário logado
create or replace function papel_atual() returns text language sql stable as $$
  select papel from perfis where id = auth.uid()
$$;

-- Perfis: cada um vê o próprio; gestor/admin veem todos
create policy perfis_self_or_gestor on perfis for select using (
  id = auth.uid() or papel_atual() in ('gestor','admin')
);

-- Clientes: todos autenticados leem (base compartilhada)
create policy clientes_auth_read on clientes for select using (auth.uid() is not null);

-- Oportunidades: comercial vê as próprias; gestor/admin veem todas
create policy op_select on oportunidades for select using (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);
create policy op_insert on oportunidades for insert with check (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);
create policy op_update on oportunidades for update using (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);

-- Metas: comercial vê a própria; gestor/admin veem todas
create policy metas_select on metas for select using (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);

-- Atividades: comercial vê as próprias; gestor/admin veem todas
create policy ativ_select on atividades for select using (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);
create policy ativ_insert on atividades for insert with check (
  responsavel_id = auth.uid()
);
