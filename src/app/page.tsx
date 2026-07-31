import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LockScreen from "@/components/LockScreen";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // role do usuário
  const { data: profile } = await supabase
    .from("profiles").select("role, email").eq("id", user.id).single();
  const role = profile?.role ?? "viewer";

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
