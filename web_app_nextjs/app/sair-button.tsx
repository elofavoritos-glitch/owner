"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function SairButton() {
  const router = useRouter();
  async function sair() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={sair} className="elo-btn elo-btn--ghost" style={{ padding: "8px 16px", fontSize: 13 }}>
      Sair
    </button>
  );
}
