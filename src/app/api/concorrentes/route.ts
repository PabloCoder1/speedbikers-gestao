import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getValidToken, palavrasChave } from "@/lib/ml-helpers";

// GET /api/concorrentes?titulo=...&preco=...
// Busca concorrentes do mesmo produto no ML, mais baratos que você,
// deduplicando por loja e trazendo quanto cada um vendeu.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const titulo = searchParams.get("titulo") || "";
  const meuPreco = parseFloat(searchParams.get("preco") || "0");
  const q = palavrasChave(titulo);
  if (!q) return NextResponse.json({ ok: true, query: "", concorrentes: [] });

  const token = await getValidToken(supabase, user.id);
  if (!token) return NextResponse.json({ error: "sem_conexao_ml" }, { status: 400 });

  // busca no ML Brasil
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(q)}&limit=50`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const t = await r.text();
    return NextResponse.json({ error: "busca_ml_falhou", detalhe: t.slice(0, 200) }, { status: 502 });
  }
  const data = await r.json();
  const results = data.results ?? [];

  // dedup por vendedor (fica com o mais barato de cada loja) + só mais baratos que você
  const porLoja = new Map<string, any>();
  for (const it of results) {
    const sellerId = it.seller?.id ?? it.seller_id ?? "?";
    const preco = it.price ?? 0;
    if (meuPreco > 0 && preco >= meuPreco) continue; // só mais baratos
    const vendidos = it.sold_quantity ?? 0;
    const atual = porLoja.get(String(sellerId));
    if (!atual || preco < atual.preco) {
      porLoja.set(String(sellerId), {
        sellerId,
        preco,
        vendidos,
        titulo: it.title,
        permalink: it.permalink,
        loja: it.seller?.nickname || it.seller?.name || null, // nem sempre vem
      });
    }
  }

  let concorrentes = [...porLoja.values()].sort((a, b) => a.preco - b.preco).slice(0, 10);

  // tenta buscar o nome das lojas que não vieram (endpoint de usuário)
  await Promise.all(concorrentes.map(async (c) => {
    if (!c.loja && c.sellerId && c.sellerId !== "?") {
      try {
        const ru = await fetch(`https://api.mercadolibre.com/users/${c.sellerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (ru.ok) { const u = await ru.json(); c.loja = u.nickname || null; }
      } catch {}
    }
  }));

  const mediaVendas = concorrentes.length
    ? Math.round(concorrentes.reduce((a, c) => a + (c.vendidos || 0), 0) / concorrentes.length)
    : 0;

  return NextResponse.json({ ok: true, query: q, mediaVendas, concorrentes });
}