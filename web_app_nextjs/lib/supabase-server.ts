// Cliente Supabase para o servidor (Server Components, Route Handlers).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function supabaseServer() {
  const store = cookies();
  return createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            store.set(name, value, options)
          );
        } catch {
          // Chamado a partir de um Server Component: a escrita de cookies não é
          // permitida aqui. O middleware cuida de renovar a sessão, então é
          // seguro ignorar.
        }
      },
    },
  });
}
