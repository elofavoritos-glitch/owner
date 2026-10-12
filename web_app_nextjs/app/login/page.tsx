"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrarEmail(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro(error.message === "Invalid login credentials"
        ? "E-mail ou senha inválidos."
        : error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function entrarMicrosoft() {
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid profile email",
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) setErro("Login Microsoft indisponível (provider Azure não configurado).");
  }

  const campo: React.CSSProperties = {
    width: "100%", padding: "11px 12px", marginBottom: 12, boxSizing: "border-box",
    border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14,
  };

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "#1F3864" }}>
      <div style={{ background: "#fff", padding: 40, borderRadius: 16, width: 360 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, color: "#1F3864", fontSize: 28, letterSpacing: 1 }}>ELO</div>
          <p style={{ color: "#607D8B", marginBottom: 24 }}>Painel Comercial</p>
        </div>

        <form onSubmit={entrarEmail}>
          <input
            type="email" placeholder="E-mail" value={email} required
            onChange={(e) => setEmail(e.target.value)} style={campo} autoComplete="email"
          />
          <input
            type="password" placeholder="Senha" value={senha} required
            onChange={(e) => setSenha(e.target.value)} style={campo} autoComplete="current-password"
          />
          {erro && (
            <p style={{ color: "#C0392B", fontSize: 13, margin: "0 0 12px" }}>{erro}</p>
          )}
          <button
            type="submit" disabled={carregando}
            style={{ width: "100%", padding: "12px 16px", background: "#1F3864", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 15, cursor: "pointer", opacity: carregando ? 0.7 : 1 }}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", color: "#90A4AE", fontSize: 12 }}>
          <span style={{ flex: 1, height: 1, background: "#E3E8F0" }} />
          OU
          <span style={{ flex: 1, height: 1, background: "#E3E8F0" }} />
        </div>

        <button
          onClick={entrarMicrosoft}
          style={{ width: "100%", padding: "12px 16px", background: "#2E75B6", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 15, cursor: "pointer" }}
        >
          Entrar com Microsoft 365
        </button>

        <p style={{ color: "#90A4AE", fontSize: 12, marginTop: 16, textAlign: "center" }}>
          Acesso restrito ao time comercial da ELO.
        </p>
      </div>
    </main>
  );
}
