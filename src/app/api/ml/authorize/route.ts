import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { credConta, CONTAS } from "@/lib/ml-helpers";

// GET /api/ml/authorize?conta=speedbikers
// Inicia o fluxo OAuth para uma CONTA específica do Mercado Livre.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const conta = searchParams.get("conta") || "speedbikers";
  if (!CONTAS.some((c) => c.id === conta)) {
    return NextResponse.json({ error: "conta inválida" }, { status: 400 });
  }

  const cred = credConta(conta);
  if (!cred.clientId) {
    return NextResponse.json({ error: `credenciais da conta ${conta} não configuradas` }, { status: 400 });
  }

  // 'state' carrega o usuário E a conta, separados por ":" — o callback usa os dois
  const state = `${user.id}:${conta}`;
  const scope = "offline_access read write";

  const url =
    `https://auth.mercadolivre.com.br/authorization?response_type=code` +
    `&client_id=${encodeURIComponent(cred.clientId)}` +
    `&redirect_uri=${encodeURIComponent(cred.redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(url);
}