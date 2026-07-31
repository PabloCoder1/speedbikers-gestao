import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/ml/callback?code=...&state=<user_id>
// O Mercado Livre redireciona aqui após o usuário autorizar.
// Trocamos o "code" por access_token + refresh_token e guardamos no banco.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // = user.id

  if (!code) return NextResponse.redirect(new URL("/?ml=erro", req.url));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== state)
    return NextResponse.redirect(new URL("/?ml=erro_sessao", req.url));

  // troca o code por tokens (server-side, o secret nunca vai ao navegador)
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.ML_CLIENT_ID!,
    client_secret: process.env.ML_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.ML_REDIRECT_URI!,
  });

  const resp = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("ML token error:", t);
    return NextResponse.redirect(new URL("/?ml=erro_token", req.url));
  }

  const tok = await resp.json();
  const expiresAt = new Date(Date.now() + (tok.expires_in ?? 21600) * 1000).toISOString();

  // upsert: 1 registro de token por usuário
  await supabase.from("ml_tokens").delete().eq("user_id", user.id);
  await supabase.from("ml_tokens").insert({
    user_id: user.id,
    ml_user_id: tok.user_id ?? null,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: expiresAt,
  });

  return NextResponse.redirect(new URL("/?ml=conectado", req.url));
}
