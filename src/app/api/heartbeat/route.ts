import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// POST /api/heartbeat -> atualiza o last_seen do usuário logado
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}