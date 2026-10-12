-- Correções de segurança apontadas na auditoria.
-- Fecha IDOR em documentos, escrita/leitura cruzada e UPDATE irrestrito de clientes.

-- ============ 1) DOCUMENTOS: só o dono (ou gestor/admin) vê/exclui ============
drop policy if exists documentos_select on documentos;
create policy documentos_select on documentos for select using (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);

-- insert permanece: o usuário cria documentos para si (responsavel_id = ele).
drop policy if exists documentos_insert on documentos;
create policy documentos_insert on documentos for insert with check (
  responsavel_id = auth.uid()
);

-- delete já restrito ao dono/gestor (mantém).
drop policy if exists documentos_delete on documentos;
create policy documentos_delete on documentos for delete using (
  responsavel_id = auth.uid() or papel_atual() in ('gestor','admin')
);

-- ============ 2) CLIENTES: UPDATE restrito ao responsável/gestor ============
-- SELECT segue compartilhado (base comum da ELO); mas editar só o dono/gestor.
drop policy if exists clientes_update on clientes;
create policy clientes_update on clientes for update using (
  responsavel_id = auth.uid() or responsavel_id is null or papel_atual() in ('gestor','admin')
);
