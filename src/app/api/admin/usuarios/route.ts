import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// confirma que quem chama é admin
async function ehAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return prof?.role === "admin" ? user : null;
}

// GET /api/admin/usuarios -> lista todos os usuários com status e atividade
export async function GET() {
  const supabase = await createClient();
  const admin = await ehAdmin(supabase);
  if (!admin) return NextResponse.json({ error: "acesso negado" }, { status: 403 });

  const adminCli = createAdminClient();
  const { data: profiles, error } = await adminCli
    .from("profiles")
    .select("id, email, nome, role, status, last_seen, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const agora = Date.now();
  const usuarios = (profiles ?? []).map((p: any) => {
    let ativoHa = null;
    if (p.last_seen) {
      const min = Math.round((agora - new Date(p.last_seen).getTime()) / 60000);
      ativoHa = min;
    }
    return { ...p, ativoHaMin: ativoHa };
  });

  return NextResponse.json({ ok: true, usuarios });
}
