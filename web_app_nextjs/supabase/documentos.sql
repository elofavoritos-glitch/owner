-- Etapa 2: upload de documentos dos clientes.
-- Cria o bucket privado de storage, a tabela de metadados e as políticas de RLS.

-- 1) Bucket privado 'documentos' (idempotente).
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- 2) Tabela de metadados: liga o arquivo no Storage ao cliente.
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  empresa text not null,
  tipo text not null default 'outro'
    check (tipo in ('planilha','contrato','cartao_cnpj','danfe','nfe','nfse','duimp','outro')),
  nome_arquivo text not null,
  caminho text not null unique,     -- path dentro do bucket (ex.: cliente_id/uuid-nome.pdf)
  tamanho_bytes bigint,
  mime text,
  responsavel_id uuid references perfis(id) on delete set null,
  responsavel_nome text,
  criado_em timestamptz default now()
);

create index if not exists idx_documentos_cliente on documentos (cliente_id);
create index if not exists idx_documentos_empresa on documentos (lower(empresa));

alter table documentos enable row level security;

drop policy if exists documentos_select on documentos;
create policy documentos_select on documentos for select using (auth.uid() is not null);

drop policy if exists documentos_insert on documentos;
create policy documentos_insert on documentos for insert with check (auth.uid() is not null);

drop policy if exists documentos_delete on documentos;
create policy documentos_delete on documentos for delete using (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);

-- 3) Políticas de acesso aos OBJETOS do bucket (storage.objects).
-- Qualquer usuário autenticado pode ler/enviar/excluir no bucket 'documentos'
-- (o controle fino de quem vê o quê fica na tabela de metadados acima; os
-- arquivos nunca são públicos — só acessíveis via URL assinada pela API).
drop policy if exists documentos_obj_select on storage.objects;
create policy documentos_obj_select on storage.objects for select
  using (bucket_id = 'documentos' and auth.uid() is not null);

drop policy if exists documentos_obj_insert on storage.objects;
create policy documentos_obj_insert on storage.objects for insert
  with check (bucket_id = 'documentos' and auth.uid() is not null);

drop policy if exists documentos_obj_delete on storage.objects;
create policy documentos_obj_delete on storage.objects for delete
  using (bucket_id = 'documentos' and auth.uid() is not null);
