import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/estoque  -> lista todos os produtos
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("produtos")
    .select("sku, nome, quantidade, marca, lead_time, custo, categoria")
    .order("nome", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, produtos: data ?? [] });
}

// PATCH /api/estoque  body: { sku, campo, valor }  -> edita um campo de um produto
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { sku, campo, valor } = await req.json();
  const permitidos = ["quantidade", "marca", "lead_time", "custo", "nome"];
  if (!sku || !permitidos.includes(campo)) {
    return NextResponse.json({ error: "campo inválido" }, { status: 400 });
  }

  const patch: any = { atualizado_em: new Date().toISOString() };
  patch[campo] = valor;

  const { error } = await supabase.from("produtos").update(patch).eq("sku", sku);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}