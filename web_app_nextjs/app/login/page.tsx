"use client";
import { supabaseBrowser } from "@/lib/supabase";

export default function Login() {
  async function entrarMicrosoft() {
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid profile email",
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "#1F3864" }}>
      <div style={{ background: "#fff", padding: 40, borderRadius: 16, textAlign: "center", width: 360 }}>
        <div style={{ fontWeight: 800, color: "#1F3864", fontSize: 28, letterSpacing: 1 }}>ELO</div>
        <p style={{ color: "#607D8B", marginBottom: 24 }}>Painel Comercial</p>
        <button
          onClick={entrarMicrosoft}
          style={{ width: "100%", padding: "12px 16px", background: "#2E75B6", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 15, cursor: "pointer" }}
        >
          Entrar com Microsoft 365
        </button>
        <p style={{ color: "#90A4AE", fontSize: 12, marginTop: 16 }}>
          Acesso restrito ao time comercial da ELO.
        </p>
      </div>
    </main>
  );
}
