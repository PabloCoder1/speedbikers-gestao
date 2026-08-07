import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getValidToken, CONTAS } from "@/lib/ml-helpers";

// GET /api/comparar-precos?minPct=5
// Para cada conta conectada, lista os anúncios (SKU + preço) e cruza:
// devolve os SKUs vendidos em mais de uma conta com diferença >= minPct.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const minPct = parseFloat(searchParams.get("minPct") || "5");

  // busca anúncios ativos de cada conta: sku -> preço
  const porConta: Record<string, Record<string, { preco: number; titulo: string; mlb: string }>> = {};
  const contasConectadas: string[] = [];

  for (const c of CONTAS) {
    const token = await getValidToken(supabase, user.id, c.id);
    if (!token) continue;
    contasConectadas.push(c.id);
    porConta[c.id] = {};

    // pega o id do vendedor
    const meR = await fetch("https://api.mercadolibre.com/users/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!meR.ok) continue;
    const me = await meR.json();
    const sellerId = me.id;

    // lista os itens do vendedor (paginado, até ~1000)
    let offset = 0;
    for (let i = 0; i < 20; i++) {
      const r = await fetch(`https://api.mercadolibre.com/users/${sellerId}/items/search?limit=50&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) break;
      const data = await r.json();
      const ids: string[] = data.results ?? [];
      if (ids.length === 0) break;

      // detalhes em lote (multiget)
      const mg = await fetch(`https://api.mercadolibre.com/items?ids=${ids.join(",")}&attributes=id,title,price,seller_custom_field,seller_sku`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (mg.ok) {
        const arr = await mg.json();
        for (const it of arr) {
          const body = it.body || it;
          const sku = body.seller_sku || body.seller_custom_field || null;
          if (!sku) continue;
          porConta[c.id][String(sku)] = { preco: body.price ?? 0, titulo: body.title ?? "", mlb: body.id ?? "" };
        }
      }
      if (ids.length < 50) break;
      offset += 50;
    }
  }

  // cruza: SKUs presentes em 2+ contas com diferença relevante
  const skusTodos = new Set<string>();
  for (const c of contasConectadas) for (const sku of Object.keys(porConta[c] || {})) skusTodos.add(sku);

  const comparacoes: any[] = [];
  for (const sku of skusTodos) {
    const precos = contasConectadas
      .filter((c) => porConta[c]?.[sku])
      .map((c) => ({ conta: c, ...porConta[c][sku] }));
    if (precos.length < 2) continue; // precisa estar em 2+ contas

    const valores = precos.map((p) => p.preco).filter((v) => v > 0);
    if (valores.length < 2) continue;
    const min = Math.min(...valores), max = Math.max(...valores);
    const diffPct = min > 0 ? ((max - min) / min) * 100 : 0;
    if (diffPct < minPct) continue; // só diferenças perceptíveis

    comparacoes.push({
      sku,
      titulo: precos[0].titulo,
      diffPct: Math.round(diffPct),
      min, max,
      precos: precos.sort((a, b) => a.preco - b.preco),
    });
  }

  comparacoes.sort((a, b) => b.diffPct - a.diffPct);
  return NextResponse.json({ ok: true, contasConectadas, total: comparacoes.length, comparacoes });
}
