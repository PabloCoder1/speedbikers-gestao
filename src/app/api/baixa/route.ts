import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// POST /api/baixa
// body: { pedidos: [{ order_id, sku, quantidade, data }] }
// Desconta do estoque só os pedidos: (a) criados depois do marco "baixa_inicio"
// e (b) ainda não processados. Registra histórico e evita baixa dupla.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { pedidos } = await req.json();
  if (!Array.isArray(pedidos)) return NextResponse.json({ error: "sem pedidos" }, { status: 400 });

  // marco de início da baixa (só desconta vendas após esta data)
  const { data: cfg } = await supabase.from("config").select("valor").eq("chave", "baixa_inicio").single();
  const inicio = cfg?.valor ? new Date(cfg.valor).getTime() : 0;

  // pedidos já processados (pra não descontar de novo)
  const ids = pedidos.map((p: any) => String(p.order_id)).filter(Boolean);
  const { data: jaProc } = await supabase
    .from("vendas_processadas").select("order_id").in("order_id", ids.length ? ids : ["__none__"]);
  const processados = new Set((jaProc ?? []).map((r: any) => r.order_id));

  // filtra: novos (não processados) e criados depois do início
  const novos = pedidos.filter((p: any) => {
    if (!p.order_id || !p.sku) return false;
    if (processados.has(String(p.order_id))) return false;
    const t = p.data ? new Date(p.data).getTime() : 0;
    return t >= inicio;
  });

  let descontados = 0, itens = 0;
  const historico: any[] = [];
  const marcados: any[] = [];

  for (const p of novos) {
    const sku = String(p.sku).trim();
    const qtd = Number(p.quantidade) || 0;
    if (qtd <= 0) continue;

    // saldo atual
    const { data: prod } = await supabase.from("produtos").select("quantidade").eq("sku", sku).single();
    if (!prod) continue; // produto não cadastrado, ignora
    const antes = Number(prod.quantidade) || 0;
    const depois = antes - qtd;

    await supabase.from("produtos").update({ quantidade: depois, atualizado_em: new Date().toISOString() }).eq("sku", sku);
    historico.push({ order_id: String(p.order_id), sku, quantidade: qtd, saldo_antes: antes, saldo_depois: depois });
    marcados.push({ order_id: String(p.order_id), sku, quantidade: qtd });
    descontados++; itens += qtd;
  }

  if (historico.length) await supabase.from("historico_baixas").insert(historico);
  if (marcados.length) await supabase.from("vendas_processadas").insert(marcados);

  return NextResponse.json({ ok: true, pedidosDescontados: descontados, itensDescontados: itens });
}