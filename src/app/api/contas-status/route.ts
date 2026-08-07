import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/contas-status -> quais contas têm token salvo (conectadas)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data } = await supabase
    .from("ml_tokens").select("conta").eq("user_id", user.id);

  const conectadas = (data ?? []).map((r: any) => r.conta);
  return NextResponse.json({ ok: true, conectadas });
}
