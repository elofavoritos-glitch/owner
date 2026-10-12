// Mantém a sessão do Supabase sincronizada em cada request (renova cookies).
// Essencial para que o login persista entre o browser e os Server Components.
//
// Blindado: qualquer falha aqui (env vars ausentes, erro de rede, etc.) NÃO
// pode derrubar o site. Em caso de erro, a requisição apenas segue adiante.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem env vars não há como renovar a sessão; segue sem bloquear.
  if (!supabaseUrl || !anon) {
    return response;
  }

  try {
    const supabase = createServerClient(supabaseUrl, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Revalida/renova a sessão e os cookies. Se falhar, ignora.
    await supabase.auth.getUser();
  } catch (e) {
    console.error("Middleware Supabase falhou (ignorado):", e);
    return NextResponse.next({ request });
  }

  return response;
}

export const config = {
  // Roda apenas em páginas; evita estáticos, assets e as rotas de API.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
