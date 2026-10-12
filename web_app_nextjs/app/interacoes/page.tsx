// Página de registro de interações (histórico de relacionamento). Protegida por login.
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import SairButton from "../sair-button";
import AjudaButton from "../ajuda-button";
import InteracoesForm from "./form";

export const dynamic = "force-dynamic";

export default async function Interacoes() {
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
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h1 style={{ color: "#1F3864", margin: 0, fontSize: 22 }}>Interações — ELO</h1>
          <Link href="/" style={{ color: "#2E75B6", fontSize: 14, textDecoration: "none" }}>← Painel</Link>
          <Link href="/clientes" style={{ color: "#2E75B6", fontSize: 14, textDecoration: "none" }}>🏢 Clientes</Link>
          <Link href="/assistente" style={{ color: "#2E75B6", fontSize: 14, textDecoration: "none" }}>💬 Assistente</Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AjudaButton titulo="Como registrar interações">
            <p>Aqui você registra cada contato com um cliente. Esse histórico alimenta o assistente,
            que passa a saber se e quando já falamos com cada empresa.</p>
            <p><strong>Campos:</strong></p>
            <ul>
              <li><strong>Canal:</strong> como foi o contato (e-mail, ligação, reunião, WhatsApp…).</li>
              <li><strong>Direção:</strong> <em>&quot;Nós contatamos&quot;</em> quando a ELO iniciou;
              <em>&quot;Cliente respondeu/procurou&quot;</em> quando houve retorno do cliente — isso define o
              estágio do relacionamento.</li>
            </ul>
            <p><strong>Estágios</strong> calculados a partir das interações:</p>
            <ul>
              <li><strong>Nunca abordada</strong> — sem registros.</li>
              <li><strong>Contatado sem resposta</strong> — só contatos nossos, sem retorno.</li>
              <li><strong>Esfriado (reativar)</strong> — houve retorno, mas o último contato tem mais de 120 dias.</li>
              <li><strong>Ativo</strong> — houve retorno e o contato é recente.</li>
            </ul>
            <p><strong>🎤</strong> Use o botão de ditar na Observação para falar em vez de digitar
            (melhor no Chrome/Edge/Android).</p>
          </AjudaButton>
          <span style={{ color: "#607D8B", fontSize: 13 }}>{user.email}</span>
          <SairButton />
        </div>
      </header>
      <InteracoesForm />
    </main>
  );
}
