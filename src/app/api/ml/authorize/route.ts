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

  const url =
    `https://auth.mercadolivre.com.br/authorization?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(url);
}
