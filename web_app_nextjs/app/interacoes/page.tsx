// Página de registro de interações (histórico de relacionamento). Protegida por login.
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import SairButton from "../sair-button";
import AjudaButton from "../ajuda-button";
import Logo from "../logo";
import { IconVoltar, IconClientes, IconAssistente } from "../icons";
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
    <main className="elo-main" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <header className="elo-header">
        <div className="elo-brand">
          <Logo height={34} />
          <span className="elo-sub" style={{ borderLeft: "1px solid var(--linha)", paddingLeft: 11, fontSize: 14 }}>Interações</span>
        </div>
        <div className="elo-actions">
          <Link href="/" className="elo-link"><IconVoltar /> Painel</Link>
          <Link href="/clientes" className="elo-link"><IconClientes /> Clientes</Link>
          <Link href="/assistente" className="elo-link"><IconAssistente /> Assistente</Link>
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
            <p>Use o botão &quot;ditar&quot; na Observação: toque, fale e toque de novo
            para parar — a transcrição aparece em seguida. Funciona em qualquer navegador, incluindo iPhone.</p>
          </AjudaButton>
          <span className="elo-email" style={{ color: "#607D8B", fontSize: 13 }}>{user.email}</span>
          <SairButton />
        </div>
      </header>
      <InteracoesForm />
    </main>
  );
}
