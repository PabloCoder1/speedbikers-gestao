import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Monta o prompt de análise pente-fino de um anúncio.
function montarPrompt(p: any, concorrentes: any[], mediaVendas: number) {
  const listaConc = concorrentes.length
    ? concorrentes.map((c, i) => `${i + 1}. R$${c.preco} — ${c.loja || "loja?"} — vendidos: ${c.vendidos ?? "?"} — "${c.titulo}"`).join("\n")
    : "Nenhum concorrente mais barato encontrado.";

  return `Você é um especialista em otimização de anúncios no Mercado Livre para uma loja de peças de moto (Speed Bikers).
Analise o anúncio abaixo de forma prática e direta, e devolva SOMENTE um JSON válido (sem markdown, sem texto fora do JSON) com esta estrutura:
{
  "resumo": "1-2 frases sobre a situação do anúncio",
  "titulo": { "veredito": "bom|ajustar|ruim", "sugestao": "novo título sugerido de até 60 caracteres", "porque": "motivo" },
  "preco": { "veredito": "competitivo|alto|baixo", "comentario": "análise vs concorrentes", "acao": "o que fazer" },
  "foto": { "sugestao": "dica de foto" },
  "descricao": { "sugestao": "dica de descrição" },
  "prioridade": "alta|media|baixa"
}

ANÚNCIO ANALISADO:
- SKU: ${p.sku}
- Título atual: "${p.titulo}"
- Preço atual: R$${p.preco ?? "?"}
- Marca: ${p.marca || "?"}
- Vendas no período: ${p.un ?? "?"} unidades (${(p.runRate ?? 0).toFixed?.(2) ?? p.runRate}/dia)
- Estoque: ${p.bal ?? "?"}
- Tendência: ${p.emQueda ? "em queda" : p.emCrescimento ? "em crescimento" : "estável"}

CONCORRENTES MAIS BARATOS (mesmo produto no Mercado Livre):
${listaConc}
Média de vendas dos concorrentes: ${mediaVendas}

Seja específico para peças de moto: cite modelo, ano e compatibilidade quando fizer sentido.`;
}

async function analisarClaude(prompt: string) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error("claude_" + r.status);
  const j = await r.json();
  const txt = (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return txt;
}

async function analisarGemini(prompt: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!r.ok) throw new Error("gemini_" + r.status);
  const j = await r.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function extrairJson(txt: string) {
  if (!txt) return null;
  const limpo = txt.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(limpo); } catch {}
  // tenta achar o primeiro objeto {...}
  const m = limpo.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// POST /api/analisar  body: { produto, concorrentes, mediaVendas }
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { produto, concorrentes = [], mediaVendas = 0 } = await req.json();
  if (!produto) return NextResponse.json({ error: "sem produto" }, { status: 400 });

  const prompt = montarPrompt(produto, concorrentes, mediaVendas);

  // tenta Claude; se falhar (erro/limite/sem key), cai pro Gemini
  let txt: string | null = null;
  let fonte = "";
  try { txt = await analisarClaude(prompt); if (txt) fonte = "claude"; } catch {}
  if (!txt) { try { txt = await analisarGemini(prompt); if (txt) fonte = "gemini"; } catch {} }

  if (!txt) return NextResponse.json({ error: "sem_ia_disponivel" }, { status: 503 });

  const analise = extrairJson(txt);
  if (!analise) return NextResponse.json({ error: "resposta_invalida", bruto: txt.slice(0, 400) }, { status: 502 });

  return NextResponse.json({ ok: true, fonte, analise });
}
