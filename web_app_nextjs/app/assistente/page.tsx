// Página do assistente comercial (chat de conversa livre). Protegida por login.
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import SairButton from "../sair-button";
import AjudaButton from "../ajuda-button";
import Chat from "./chat";

export const dynamic = "force-dynamic";

export default async function Assistente() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/");
  }

  const supabase = supabaseServer();
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  if (!user) redirect("/login");

  return (
    <main className="elo-main" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <header className="elo-header" style={{ marginBottom: 8 }}>
        <div className="elo-nav">
          <h1 style={{ color: "#1F3864", margin: 0, fontSize: 22 }}>Assistente Comercial — ELO</h1>
          <Link href="/" style={{ color: "#2E75B6", fontSize: 14, textDecoration: "none" }}>← Painel</Link>
          <Link href="/clientes" style={{ color: "#2E75B6", fontSize: 14, textDecoration: "none" }}>🏢 Clientes</Link>
        </div>
        <div className="elo-actions">
          <AjudaButton titulo="Como usar o Assistente">
            <p>O assistente comercial usa os dados reais da ELO e <strong>nunca inventa informações</strong>.</p>
            <p><strong>O que você pode pedir:</strong></p>
            <ul>
              <li>Consultar o funil: <em>&quot;quais oportunidades estão em negociação?&quot;</em></li>
              <li>Montar dossiê de um cliente (score, serviços e próxima ação): <em>&quot;monte o dossiê da Transportadora Horizonte&quot;</em></li>
              <li>Ver relacionamento: <em>&quot;já falamos com a AgroInsumos?&quot;</em></li>
              <li>Registrar um contato: <em>&quot;registra: liguei pra MetalForte, pediram cotação&quot;</em></li>
            </ul>
            <p><strong>🎤 Falar em vez de digitar:</strong> toque no microfone e fale. Funciona melhor no
            Chrome, Edge e Android; no primeiro uso o navegador pede permissão de microfone. No Safari/iPhone
            o recurso pode não aparecer.</p>
            <p style={{ color: "#64748B", fontSize: 13 }}>O assistente respeita suas permissões: um comercial
            vê a própria carteira; um gestor vê o time todo.</p>
          </AjudaButton>
          <span className="elo-email" style={{ color: "#607D8B", fontSize: 13 }}>{user.email}</span>
          <SairButton />
        </div>
      </header>
      <Chat email={user.email ?? ""} />
    </main>
  );
}
