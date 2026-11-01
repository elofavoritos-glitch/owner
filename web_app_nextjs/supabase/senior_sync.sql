-- Recebimento de clientes enviados pelo Senior ERP (G5, Senior Cloud).
--
-- O ERP não aceita conexões de fora, mas consegue SAIR para a internet. Então
-- uma regra LSP no ERP lê a tabela E085CLI e envia os clientes para
-- POST /api/senior/clientes. Esta migração prepara o banco para isso.
--
-- Segurança: o endpoint não tem sessão de usuário. Ele repassa um token para a
-- função senior_receber_clientes(), que roda como "security definer" e só grava
-- se o token bater com o hash guardado em integracao_tokens. Essa tabela tem RLS
-- ligado e nenhuma policy, então ninguém lê pelo cliente Supabase.
--
-- Como rodar: Supabase > SQL Editor > colar este arquivo inteiro > Run.
-- O último SELECT mostra o token UMA vez. Copie e cole na regra do ERP.
-- Rodar de novo gera um token novo e invalida o anterior.

-- 1) Colunas de vínculo com o ERP ------------------------------------------
alter table clientes add column if not exists codigo_senior integer;
alter table clientes add column if not exists nome_fantasia text;
alter table clientes add column if not exists situacao_senior text;
alter table clientes add column if not exists sincronizado_senior_em timestamptz;

create unique index if not exists uq_clientes_codigo_senior
  on clientes (codigo_senior) where codigo_senior is not null;

-- 2) Tokens de integração (só a função lê) ---------------------------------
create table if not exists integracao_tokens (
  nome text primary key,
  token_hash text not null,
  criado_em timestamptz not null default now()
);
alter table integracao_tokens enable row level security;
revoke all on integracao_tokens from anon, authenticated;

-- 3) Função que recebe um lote de clientes ---------------------------------
-- p_clientes: array JSON de objetos
--   { codigo, empresa, fantasia, cnpj, cidade, uf, telefone, email, situacao }
-- Retorna quantos registros foram gravados (inseridos + atualizados).
create or replace function senior_receber_clientes(p_token text, p_clientes jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_total integer;
begin
  select token_hash into v_hash from integracao_tokens where nome = 'senior_erp';
  if v_hash is null
     or p_token is null
     or encode(sha256(convert_to(p_token, 'UTF8')), 'hex') <> v_hash then
    raise exception 'token invalido' using errcode = '28000';
  end if;

  if jsonb_typeof(p_clientes) <> 'array' or jsonb_array_length(p_clientes) > 1000 then
    raise exception 'lote invalido' using errcode = '22023';
  end if;

  -- Clientes já cadastrados à mão (sem código do ERP) com o mesmo CNPJ ganham o
  -- vínculo, para não duplicar.
  update clientes c
     set codigo_senior = (r->>'codigo')::integer
    from jsonb_array_elements(p_clientes) r
   where c.codigo_senior is null
     and coalesce(r->>'cnpj', '') <> ''
     and regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') = r->>'cnpj'
     and not exists (select 1 from clientes x where x.codigo_senior = (r->>'codigo')::integer);

  -- Insere ou atualiza pelo código do ERP. Não mexe em responsável, segmento,
  -- observações e demais campos mantidos pelo comercial.
  insert into clientes as c
    (codigo_senior, empresa, nome_fantasia, cnpj, cidade, uf, telefone, email,
     situacao_senior, sincronizado_senior_em, atualizado_em)
  select (r->>'codigo')::integer,
         left(r->>'empresa', 160),
         nullif(left(r->>'fantasia', 160), ''),
         nullif(r->>'cnpj', ''),
         nullif(left(r->>'cidade', 80), ''),
         nullif(left(r->>'uf', 2), ''),
         nullif(left(r->>'telefone', 30), ''),
         nullif(left(r->>'email', 160), ''),
         nullif(left(r->>'situacao', 1), ''),
         now(), now()
    from jsonb_array_elements(p_clientes) r
   where (r->>'codigo') ~ '^\d{1,9}$'
     and coalesce(r->>'empresa', '') <> ''
  on conflict (codigo_senior) where codigo_senior is not null do update
     set empresa = excluded.empresa,
         nome_fantasia = excluded.nome_fantasia,
         cnpj = coalesce(excluded.cnpj, c.cnpj),
         cidade = coalesce(excluded.cidade, c.cidade),
         uf = coalesce(excluded.uf, c.uf),
         telefone = coalesce(excluded.telefone, c.telefone),
         email = coalesce(excluded.email, c.email),
         situacao_senior = excluded.situacao_senior,
         sincronizado_senior_em = now(),
         atualizado_em = now();

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function senior_receber_clientes(text, jsonb) from public;
grant execute on function senior_receber_clientes(text, jsonb) to anon, authenticated;

-- 4) Gera o token (mostrado uma única vez) ---------------------------------
with novo as (
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') as token
), gravado as (
  insert into integracao_tokens (nome, token_hash)
  select 'senior_erp', encode(sha256(convert_to(token, 'UTF8')), 'hex') from novo
  on conflict (nome) do update set token_hash = excluded.token_hash, criado_em = now()
  returning nome
)
select token as "COPIE ESTE TOKEN PARA A REGRA DO ERP" from novo, gravado;
