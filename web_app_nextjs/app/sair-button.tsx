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
    <button
      onClick={sair}
      style={{ padding: "8px 14px", background: "#fff", color: "#1F3864",
        border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
    >
      Sair
    </button>
  );
}
