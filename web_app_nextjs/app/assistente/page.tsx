// Página do assistente comercial (chat de conversa livre). Protegida por login.
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import SairButton from "../sair-button";
import AjudaButton from "../ajuda-button";
import Logo from "../logo";
import { IconVoltar, IconClientes } from "../icons";
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
    <main className="elo-main">
      <header className="elo-header">
        <div className="elo-brand">
          <Logo height={34} />
          <span className="elo-sub" style={{ borderLeft: "1px solid var(--linha)", paddingLeft: 11, fontSize: 14 }}>Assistente</span>
        </div>
        <div className="elo-actions">
          <Link href="/" className="elo-link"><IconVoltar /> Painel</Link>
          <Link href="/clientes" className="elo-link"><IconClientes /> Clientes</Link>
          <AjudaButton titulo="Como usar o Assistente">
            <p>O assistente comercial usa os dados reais da ELO e <strong>nunca inventa informações</strong>.</p>
            <p><strong>O que você pode pedir:</strong></p>
            <ul>
              <li>Consultar o funil: <em>&quot;quais oportunidades estão em negociação?&quot;</em></li>
              <li>Montar dossiê de um cliente (score, serviços e próxima ação): <em>&quot;monte o dossiê da Transportadora Horizonte&quot;</em></li>
              <li>Ver relacionamento: <em>&quot;já falamos com a AgroInsumos?&quot;</em></li>
              <li>Registrar um contato: <em>&quot;registra: liguei pra MetalForte, pediram cotação&quot;</em></li>
            </ul>
            <p><strong>Falar em vez de digitar:</strong> toque no microfone, fale e toque de novo para
            parar — a transcrição aparece em 1-2 segundos. Funciona em qualquer navegador, incluindo o
            iPhone/Safari. No primeiro uso, autorize o microfone.</p>
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
