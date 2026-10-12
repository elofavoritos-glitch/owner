// Helpers de segurança para as rotas de API.

// Escapa um termo para uso seguro em filtros .ilike/.or do PostgREST.
// Remove caracteres que têm significado especial em filtros (vírgula, parênteses,
// aspas) e neutraliza os curingas % e _ do LIKE. Evita injeção de filtro e
// curingas não intencionais.
export function escaparBusca(termo: string, max = 80): string {
  return String(termo ?? "")
    .slice(0, max)
    .replace(/[,()"'\\*]/g, " ") // caracteres perigosos em filtros PostgREST
    .replace(/[%_]/g, " ")        // curingas do LIKE
    .trim();
}

// Valida data no formato AAAA-MM-DD; retorna a data ou null.
export function validarData(valor: unknown): string | null {
  const s = String(valor ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

// Trunca texto a um limite, retornando null se vazio.
export function texto(valor: unknown, max = 2000): string | null {
  const s = String(valor ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

// Mensagem de erro genérica para o cliente (não vaza detalhe interno).
// O detalhe real deve ser logado no servidor com console.error.
export function erroGenerico(contexto: string): string {
  return `Não foi possível ${contexto}. Tente novamente.`;
}
