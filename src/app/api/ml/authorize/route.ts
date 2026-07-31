import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/ml/authorize
// Inicia o fluxo OAuth: manda o usuário para o Mercado Livre autorizar o app.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const clientId = process.env.ML_CLIENT_ID!;
  const redirect = process.env.ML_REDIRECT_URI!;

  // 'state' liga o retorno do ML ao nosso usuário logado
  const state = user.id;

  // offline_access é OBRIGATÓRIO para o ML devolver um refresh_token.
  // Sem ele, só volta o access_token de 6h e a gravação no banco falha.
  const scope = "offline_access read write";

  const url =
    `https://auth.mercadolivre.com.br/authorization?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(url);
}