import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Garante um access_token válido, renovando com refresh_token se expirado.
async function getValidToken(supabase: any, userId: string) {
  const { data: row } = await supabase
    .from("ml_tokens").select("*").eq("user_id", userId).single();
  if (!row) return null;

  const expired = new Date(row.expires_at).getTime() < Date.now() + 60_000;
  if (!expired) return row.access_token;

  // renova
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.ML_CLIENT_ID!,
    client_secret: process.env.ML_CLIENT_SECRET!,
    refresh_token: row.refresh_token,
  });
  const resp = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!resp.ok) return null;
  const tok = await resp.json();
  const expiresAt = new Date(Date.now() + (tok.expires_in ?? 21600) * 1000).toISOString();
  await supabase.from("ml_tokens").update({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? row.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  return tok.access_token;
}

// GET /api/ml/sync
// Puxa vendas recentes do vendedor e devolve linhas já no formato que o
// dashboard entende (sku, titulo, data, unidades, receita, preço).
// GET /api/ml/sync?dias=30  (7 | 30 | 60 | 90 | 0=total)
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const token = await getValidToken(supabase, user.id);
  if (!token) return NextResponse.json({ error: "sem_conexao_ml" }, { status: 400 });

  // quem é o vendedor
  const meResp = await fetch("https://api.mercadolibre.com/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meResp.ok) return NextResponse.json({ error: "token_invalido" }, { status: 400 });
  const me = await meResp.json();
  const sellerId = me.id;

  // período escolhido no app (0 = pega o máximo que a API deixar)
  const { searchParams } = new URL(req.url);
  const dias = parseInt(searchParams.get("dias") || "60", 10);

  // filtro de data: se dias>0, limita; se dias=0, busca tudo (até o teto da API)
  const desdeParam = dias > 0
    ? `&order.date_created.from=${encodeURIComponent(new Date(Date.now() - dias * 86400_000).toISOString())}`
    : "";

  // A API de pedidos do ML permite paginar até ~10.000 registros (offset máx).
  // Vamos até 200 páginas de 50 = 10.000 pedidos, parando antes se acabar.
  const MAX_PAGINAS = 200;
  const rows: any[] = [];
  let offset = 0;
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const url =
      `https://api.mercadolibre.com/orders/search?seller=${sellerId}` +
      desdeParam +
      `&sort=date_desc&limit=50&offset=${offset}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) break;
    const data = await r.json();
    const results = data.results ?? [];
    for (const o of results) {
      // ignora pedidos cancelados (o painel do ML não os soma no faturamento)
      if (o.status === "cancelled") continue;
      const itens = o.order_items ?? [];
      // soma dos itens (preço cheio do anúncio × qtd) — base para ratear o total do pedido
      const somaItens = itens.reduce((s: number, it: any) => s + (it.unit_price ?? 0) * (it.quantity ?? 0), 0);
      // valor total do pedido conforme o ML (inclui o que o painel mostra)
      const totalPedido = o.total_amount ?? o.paid_amount ?? somaItens;
      for (const it of itens) {
        const valorItem = (it.unit_price ?? 0) * (it.quantity ?? 0);
        // rateia o total do pedido proporcionalmente entre os itens (casa com o painel do ML)
        const receitaItem = somaItens > 0 ? totalPedido * (valorItem / somaItens) : valorItem;
        rows.push({
          sku: it.item?.seller_sku || it.item?.seller_custom_field || String(it.item?.id || ""),
          mlb: it.item?.id || "",
          titulo: it.item?.title || "",
          data: o.date_created,
          unidades: it.quantity ?? 0,
          receita: receitaItem,
          preco: it.unit_price ?? 0,
          oficial: "",
        });
      }
    }
    if (results.length < 50) break;   // acabaram os pedidos
    offset += 50;
    // proteção: o ML rejeita offset acima de ~10.000
    if (offset >= 10000) break;
  }

  return NextResponse.json({ ok: true, seller: sellerId, count: rows.length, dias, rows });
}