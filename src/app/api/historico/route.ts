import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/historico -> últimas 100 baixas
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("historico_baixas")
    .select("order_id, sku, quantidade, saldo_antes, saldo_depois, criado_em")
    .order("criado_em", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, historico: data ?? [] });
}