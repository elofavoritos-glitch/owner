// Geração de propostas comerciais (PDF). Protegida por login.
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import SairButton from "../sair-button";
import AjudaButton from "../ajuda-button";
import PropostasForm from "./form";

export const dynamic = "force-dynamic";

export default async function Propostas() {
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
      <header className="elo-header">
        <div className="elo-nav">
          <h1 style={{ color: "#1F3864", margin: 0, fontSize: 22 }}>Propostas — ELO</h1>
          <Link href="/" style={{ color: "#2E75B6", fontSize: 14, textDecoration: "none" }}>← Painel</Link>
          <Link href="/clientes" style={{ color: "#2E75B6", fontSize: 14, textDecoration: "none" }}>🏢 Clientes</Link>
          <Link href="/assistente" style={{ color: "#2E75B6", fontSize: 14, textDecoration: "none" }}>💬 Assistente</Link>
        </div>
        <div className="elo-actions">
          <AjudaButton titulo="Como gerar propostas">
            <p>Monte uma proposta comercial em PDF com a identidade da ELO. O PDF é
            <strong> salvo automaticamente nos documentos do cliente</strong> e pode ser aberto/baixado.</p>
            <ul>
              <li>Selecione o cliente (vem do cadastro).</li>
              <li>Adicione itens com descrição, quantidade e valor unitário.</li>
              <li>Item <strong>sem valor</strong> entra como &quot;a definir&quot; e não soma no total —
              nunca inventamos preço.</li>
            </ul>
            <p style={{ color: "#64748B", fontSize: 13 }}>Você também pode pedir uma proposta ao
            <strong> 💬 Assistente</strong> em conversa.</p>
          </AjudaButton>
          <span className="elo-email" style={{ color: "#607D8B", fontSize: 13 }}>{user.email}</span>
          <SairButton />
        </div>
      </header>
      <PropostasForm />
    </main>
  );
}
