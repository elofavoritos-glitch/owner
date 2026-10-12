// Cadastro de clientes. Protegida por login.
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import SairButton from "../sair-button";
import AjudaButton from "../ajuda-button";
import Logo from "../logo";
import { IconVoltar, IconInteracoes, IconAssistente } from "../icons";
import ClientesForm from "./form";

export const dynamic = "force-dynamic";

export default async function Clientes() {
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
        <div className="elo-brand">
          <Logo size={34} />
          <div>
            <div className="elo-wordmark">Clientes</div>
            <div className="elo-sub">Cadastro ELO</div>
          </div>
        </div>
        <div className="elo-actions">
          <Link href="/" className="elo-link"><IconVoltar /> Painel</Link>
          <Link href="/interacoes" className="elo-link"><IconInteracoes /> Interações</Link>
          <Link href="/assistente" className="elo-link"><IconAssistente /> Assistente</Link>
          <AjudaButton titulo="Cadastro de clientes">
            <p>Centralize aqui os dados dos clientes da ELO. Esse cadastro é a base para
            anexar documentos e para enriquecer as análises do assistente.</p>
            <ul>
              <li><strong>Empresa</strong> é o único campo obrigatório; os demais ajudam no contato e na qualificação.</li>
              <li>Use a <strong>busca</strong> por empresa ou CNPJ para localizar rapidamente.</li>
            </ul>
            <p style={{ color: "#64748B", fontSize: 13 }}>O cadastro é compartilhado pelo time; o responsável
            registrado é quem criou.</p>
          </AjudaButton>
          <span className="elo-email" style={{ color: "#607D8B", fontSize: 13 }}>{user.email}</span>
          <SairButton />
        </div>
      </header>
      <ClientesForm />
    </main>
  );
}
