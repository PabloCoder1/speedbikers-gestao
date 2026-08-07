import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LockScreen from "@/components/LockScreen";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // role e status do usuário
  const { data: profile } = await supabase
    .from("profiles").select("role, email, status").eq("id", user.id).single();
  const role = profile?.role ?? "viewer";
  const status = profile?.status ?? "aprovado";

  // usuário pendente: aguarda aprovação do admin (admin nunca fica preso)
  if (status === "pendente" && role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f8fb", fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: "center", background: "#fff", border: "1px solid #e6eaf0", borderRadius: 20, padding: "40px 32px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#16233a" }}>Cadastro em análise</h1>
          <p style={{ fontSize: 14, color: "#6b7a93", lineHeight: 1.5 }}>
            Sua conta foi criada e está aguardando a aprovação do administrador.
            Você receberá acesso assim que for liberado. Em caso de dúvida, fale com o Pablo Lima — 13 991560814.
          </p>
          <form action="/api/auth/signout" method="post" style={{ marginTop: 24 }}>
            <a href="/login" style={{ fontSize: 13, fontWeight: 700, color: "#1e47ba", textDecoration: "none" }}>Voltar ao login</a>
          </form>
        </div>
      </div>
    );
  }

  // estado de bloqueio (global)
  const { data: lock } = await supabase
    .from("app_state").select("locked").eq("id", 1).single();
  const locked = lock?.locked ?? false;

  // se bloqueado e NÃO for admin, mostra tela de contato
  if (locked && role !== "admin") return <LockScreen />;

  return (
    <Dashboard
      role={role}
      email={profile?.email ?? user.email ?? ""}
      initialLocked={locked}
    />
  );
}
