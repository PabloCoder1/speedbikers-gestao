// Helpers compartilhados para integração com o Mercado Livre.

// As 4 contas do Mercado Livre. Cada uma tem sua própria aplicação (client_id/secret),
// configurada nas variáveis de ambiente da Vercel.
export const CONTAS = [
  { id: "speedbikers", nome: "SpeedBikers" },
  { id: "offracer", nome: "OffRacer" },
  { id: "sb", nome: "SB" },
  { id: "gmr", nome: "GMR" },
];

// pega as credenciais de uma conta a partir das env vars
// ex.: conta "speedbikers" -> ML_CLIENT_ID_SPEEDBIKERS / ML_CLIENT_SECRET_SPEEDBIKERS
export function credConta(conta: string) {
  const up = conta.toUpperCase();
  return {
    clientId: process.env[`ML_CLIENT_ID_${up}`] || process.env.ML_CLIENT_ID || "",
    clientSecret: process.env[`ML_CLIENT_SECRET_${up}`] || process.env.ML_CLIENT_SECRET || "",
    redirectUri: process.env.ML_REDIRECT_URI || "",
  };
}

// Garante um access_token válido para uma CONTA específica, renovando se expirado.
export async function getValidToken(supabase: any, userId: string, conta: string = "speedbikers") {
  const { data: row } = await supabase
    .from("ml_tokens").select("*").eq("user_id", userId).eq("conta", conta).single();
  if (!row) return null;

  const expired = new Date(row.expires_at).getTime() < Date.now() + 60_000;
  if (!expired) return row.access_token;

  const cred = credConta(conta);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: cred.clientId,
    client_secret: cred.clientSecret,
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
  }).eq("user_id", userId).eq("conta", conta);
  return tok.access_token;
}

// Extrai palavras-chave de busca do título: tipo de peça + modelo + cilindrada.
// Ex.: "Amortecedor Traseiro PCX 160 2021 Original" -> "amortecedor pcx 160"
export function palavrasChave(titulo: string): string {
  const t = (titulo || "").toLowerCase();
  // tipos de peça comuns
  const pecas = ["amortecedor", "paralama", "farol", "manete", "retrovisor", "carenagem",
    "guidao", "guidão", "bau", "baú", "bauleto", "escapamento", "pisca", "lanterna",
    "banco", "pedaleira", "corrente", "coroa", "pinhao", "pinhão", "relacao", "relação",
    "disco", "pastilha", "cabo", "velocimetro", "velocímetro", "tanque", "bomba",
    "bobina", "cdi", "regulador", "rele", "relé", "chave", "cilindro", "pistao", "pistão",
    "junta", "reparo", "kit", "sensor", "bico", "filtro", "vela", "bateria", "capa",
    "protetor", "slider", "bolha", "adesivo", "grip", "punho", "acelerador"];
  // modelos de moto comuns
  const modelos = ["cg", "cb", "cbx", "xre", "bros", "fan", "titan", "biz", "pop", "nxr",
    "pcx", "adv", "sh", "elite", "lead", "nmax", "xmax", "fazer", "factor", "ys", "yes",
    "xtz", "lander", "tenere", "ténéré", "crosser", "neo", "fluo", "ninja", "z400", "z900",
    "mt", "xj6", "hornet", "cbr", "twister", "tornado", "falcon", "next", "burgman"];
  const found: string[] = [];
  for (const p of pecas) if (t.includes(p)) { found.push(p); break; }
  for (const m of modelos) {
    // pega modelo + número seguinte (ex.: "pcx 160")
    const re = new RegExp(`\\b${m}\\s*(\\d{2,3})?`, "i");
    const mm = t.match(re);
    if (mm) { found.push(mm[0].trim()); break; }
  }
  const q = found.join(" ").trim();
  // fallback: primeiras 4 palavras do título
  return q || t.split(/\s+/).slice(0, 4).join(" ");
}