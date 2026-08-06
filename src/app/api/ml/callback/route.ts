import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { credConta } from "@/lib/ml-helpers";

// GET /api/ml/callback?code=...&state=<user_id>:<conta>
// O Mercado Livre redireciona aqui após o usuário autorizar uma conta.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "";
  const [userId, contaRaw] = state.split(":");
  const conta = contaRaw || "speedbikers";

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/?ml=erro_sem_code", req.url));
  }

  const cred = credConta(conta);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cred.clientId,
    client_secret: cred.clientSecret,
    code,
    redirect_uri: cred.redirectUri,
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

  const admin = createAdminClient();
  // remove token antigo desta conta e grava o novo
  await admin.from("ml_tokens").delete().eq("user_id", userId).eq("conta", conta);
  const { error } = await admin.from("ml_tokens").insert({
    user_id: userId,
    conta,
    ml_user_id: tok.user_id ?? null,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? "",
    expires_at: expiresAt,
  });

  if (error) {
    console.error("Supabase insert error:", error.message);
    return NextResponse.redirect(new URL("/?ml=erro_gravar", req.url));
  }

  return NextResponse.redirect(new URL(`/?ml=conectado&conta=${conta}`, req.url));
}