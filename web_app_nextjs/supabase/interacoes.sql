-- Histórico de interações/relacionamento (Opção B — sem Microsoft 365).
-- Registra contatos com empresas para o chat responder "já falamos com essa
-- empresa? qual o estágio do relacionamento?" sem depender do Outlook.

create table if not exists interacoes (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  responsavel_id uuid references perfis(id) on delete set null,
  responsavel_nome text,
  canal text not null default 'email'
    check (canal in ('email','ligacao','reuniao','whatsapp','evento','outro')),
  direcao text not null default 'enviado'
    check (direcao in ('enviado','recebido')),
  -- direcao = 'recebido' indica resposta/iniciativa do cliente
  assunto text,
  data_interacao date not null default current_date,
  observacao text,
  criado_em timestamptz default now()
);

create index if not exists idx_interacoes_empresa on interacoes (lower(empresa));
create index if not exists idx_interacoes_responsavel on interacoes (responsavel_id);
create index if not exists idx_interacoes_data on interacoes (data_interacao);

-- ===================== RLS =====================
alter table interacoes enable row level security;

-- Comercial vê as próprias interações; gestor/admin veem todas.
drop policy if exists interacoes_select on interacoes;
create policy interacoes_select on interacoes for select using (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);

drop policy if exists interacoes_insert on interacoes;
create policy interacoes_insert on interacoes for insert with check (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);

drop policy if exists interacoes_update on interacoes;
create policy interacoes_update on interacoes for update using (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);
