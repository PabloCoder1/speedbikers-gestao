/* ============================================================
   Speed Bikers — Núcleo de análise (compartilhado entre
   upload de Excel e sincronização via API do Mercado Livre).
   Sem dependência de React. Roda no navegador.
   ============================================================ */
import * as XLSX from "xlsx";

/* ============================================================
   Speed Bikers — Gestão de Compras & Saúde dos Produtos
   Processamento 100% no navegador. Vínculo Vendas↔Estoque por SKU.
   ============================================================ */

const MESES = { janeiro: 1, fevereiro: 2, "março": 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

function parseVendaDate(s) {
  if (s == null) return null;
  const str = String(s).trim();
  // formato do Excel do ML: "29 de julho de 2026"
  const m = str.toLowerCase().match(/(\d{1,2}) de (\p{L}+) de (\d{4})/u);
  if (m) {
    const mo = MESES[m[2]]; if (mo) return new Date(Number(m[3]), mo - 1, Number(m[1]));
  }
  // formato ISO vindo da API do ML: "2026-07-29T10:20:00.000-03:00"
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}
function parseEstoqueDate(s) {
  if (s == null) return null;
  if (s instanceof Date) return s;
  const m = String(s).trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  const d = new Date(s); return isNaN(d) ? null : d;
}
const num = (v) => {
  if (v == null || v === "" || v === "-") return NaN;
  if (typeof v === "number") return isNaN(v) ? NaN : v;
  let s = String(v).trim();
  if (s === "-" || s === "") return NaN;
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s); return isNaN(n) ? NaN : n;
};
const n0 = (v) => { const x = num(v); return isNaN(x) ? 0 : x; };
export const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const brlc = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
export const dstr = (d) => d ? d.toLocaleDateString("pt-BR") : "—";
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + Math.round(n)); return x; };

export function readSheetSmart(wb, wanted) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  let hi = 0, best = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] || []).map((c) => String(c || "").trim().toLowerCase());
    const hits = wanted.filter((w) => cells.some((c) => c === w.toLowerCase())).length;
    if (hits > best) { best = hits; hi = i; }
  }
  const header = (rows[hi] || []).map((c) => String(c || "").trim());
  // duplicate column names (ML has 3x "Unidades"): keep the FIRST index per name
  const firstIdx = {};
  header.forEach((h, j) => { if (h && !(h in firstIdx)) firstIdx[h] = j; });
  const names = Object.keys(firstIdx);
  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const o = {}; let empty = true;
    for (const h of names) { const v = r[firstIdx[h]] ?? null; o[h] = v; if (v != null && v !== "") empty = false; }
    if (!empty) out.push(o);
  }
  return out;
}

// ---------------- analysis ----------------
export function analyze(vendasRaw, estoqueRaw, opts) {
  const { leadOff, leadOutro, coberturaDias = 90, margem = 0.2 } = opts;

  const V = vendasRaw.map((r) => {
    const dt = parseVendaDate(r["Data da venda"]);
    return {
      sku: r["SKU"] != null ? String(r["SKU"]).trim() : null,
      mlb: r["# de anúncio"] ? String(r["# de anúncio"]).trim() : "",
      titulo: r["Título do anúncio"] ? String(r["Título do anúncio"]).trim() : "",
      dt, un: n0(r["Unidades"]),
      net: n0(r["Receita por produtos (BRL)"]) + n0(r["Cancelamentos e reembolsos (BRL)"]),
      preco: n0(r["Preço unitário de venda do anúncio (BRL)"]),
      oficial: String(r["Loja oficial"] || "").trim(),
    };
  }).filter((r) => r.sku && r.dt && r.sku !== "nan");

  if (!V.length) throw new Error("Não encontrei linhas de venda válidas (SKU + data).");

  const maxD = new Date(Math.max(...V.map((r) => +r.dt)));
  const minD = new Date(Math.min(...V.map((r) => +r.dt)));
  const days = Math.max(1, Math.round((maxD - minD) / 86400000) + 1);
  const mid = addDays(maxD, -15);
  const priorStart = addDays(mid, -15);
  const meioPeriodo = new Date((+maxD + +minD) / 2); // divide o período em 2 metades p/ tendência

  // per-SKU aggregation
  const S = new Map();
  for (const r of V) {
    let o = S.get(r.sku);
    if (!o) o = { sku: r.sku, mlb: r.mlb, titulo: r.titulo, un: 0, fat: 0, oficial: false, titulos: new Set(), unRecent: 0, unPrior: 0, precoRecent: [], precoPrior: [], rows: [], unH1: 0, unH2: 0 }, S.set(r.sku, o);
    o.un += r.un; o.fat += r.net;
    o.rows.push(r);
    if (r.titulo) { o.titulo = r.titulo; o.titulos.add(r.titulo); }
    if (r.mlb) o.mlb = r.mlb;
    if (r.oficial.toLowerCase() === "offracer") o.oficial = true;
    if (r.dt < meioPeriodo) o.unH1 += r.un; else o.unH2 += r.un;
    if (r.dt > mid) { o.unRecent += r.un; if (r.preco > 0) o.precoRecent.push(r.preco); }
    else if (r.dt > priorStart) { o.unPrior += r.un; if (r.preco > 0) o.precoPrior.push(r.preco); }
  }
  const diasMetade = days / 2;

  // ---- stock: Supabase (produtos) por padrão; planilha do Upseller como reserva ----
  const { produtosSupabase } = opts;
  const saldo = new Map();
  const leadPorSku = new Map();   // lead time por SKU (vindo da marca no Supabase)
  const marcaPorSku = new Map();  // marca por SKU
  let hasStock = false;
  let fonteEstoque = "nenhuma";

  if (produtosSupabase && produtosSupabase.length > 0) {
    // marcas importadas => 90 dias; demais => 15 dias
    const IMPORTADOS = new Set(["off racer", "navetec"]);
    for (const p of produtosSupabase) {
      const sku = p.sku != null ? String(p.sku).trim() : null;
      if (!sku) continue;
      const q = num(p.quantidade);
      if (!isNaN(q)) saldo.set(sku, q);
      const marca = p.marca ? String(p.marca).trim() : "";
      marcaPorSku.set(sku, marca);
      // lead: usa regra por marca (importado 90, resto 15); respeita lead_time do produto se vier
      const marcaNorm = marca.toLowerCase();
      const leadRegra = IMPORTADOS.has(marcaNorm) ? 90 : 15;
      leadPorSku.set(sku, leadRegra);
    }
    hasStock = true;
    fonteEstoque = "supabase";
  } else {
    // reserva: planilha do Upseller (último "Novo Estoque Atual" por SKU)
    const E = (estoqueRaw || []).map((r) => ({
      sku: r["SKU"] != null ? String(r["SKU"]).trim() : null,
      dt: parseEstoqueDate(r["Tempo"]),
      atual: num(r["Novo Estoque Atual"]),
    })).filter((r) => r.sku && r.dt);
    E.sort((a, b) => a.dt - b.dt);
    for (const r of E) if (!isNaN(r.atual)) saldo.set(r.sku, r.atual);
    hasStock = E.length > 0;
    if (hasStock) fonteEstoque = "planilha";
  }

  // enrich each SKU
  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const list = [...S.values()].map((o) => {
    const runRate = o.un / days;
    const bal = saldo.has(o.sku) ? saldo.get(o.sku) : null;
    const ruptura = bal != null && bal <= 0;
    const trocaTitulo = o.titulos.size > 1;

    // ---- tendência: velocidade da 2ª metade vs 1ª metade do período ----
    const rrH1 = o.unH1 / diasMetade;
    const rrH2 = o.unH2 / diasMetade;
    // só confia na tendência com base mínima de vendas
    const tendConfiavel = o.un >= 10 && rrH1 > 0;
    const tendPct = tendConfiavel ? ((rrH2 - rrH1) / rrH1) * 100 : 0; // % de variação
    const emCrescimento = tendConfiavel && tendPct >= 25;
    const emQueda = tendConfiavel && tendPct <= -25;

    // velocity drop 15v15
    const dropPct = o.unPrior >= 5 ? ((o.unRecent - o.unPrior) / o.unPrior) * 100 : null;
    const queda = dropPct != null && dropPct <= -40;
    // restock projection — lead por marca (Supabase) ou regra oficial (planilha)
    let diasZero = null, dataZero = null, dataPedido = null;
    let lead = leadPorSku.has(o.sku) ? leadPorSku.get(o.sku) : (o.oficial ? leadOff : leadOutro);
    if (bal != null && runRate > 0) {
      diasZero = bal / runRate;
      dataZero = addDays(maxD, diasZero);
      dataPedido = addDays(dataZero, -lead);
    }
    // price change (recent vs prior window)
    const pr = median(o.precoRecent), pp = median(o.precoPrior);
    const priceChg = pr && pp ? pr - pp : 0;

    // ---- título: análise antes/depois da troca ----
    // Descobre quando o título mudou (1ª venda do título mais recente) e compara
    // a velocidade de vendas antes vs depois. Antes de culpar o título, checa preço.
    let tituloDiag = null;
    if (trocaTitulo) {
      const rows = [...o.rows].sort((a, b) => a.dt - b.dt);
      const novoTit = rows[rows.length - 1].titulo;
      const troca = rows.find((r) => r.titulo === novoTit);
      const dtTroca = troca ? troca.dt : null;
      if (dtTroca) {
        const antes = rows.filter((r) => r.dt < dtTroca);
        const depois = rows.filter((r) => r.dt >= dtTroca);
        if (antes.length && depois.length) {
          const dA = Math.max(1, Math.round((dtTroca - antes[0].dt) / 86400000) + 1);
          const dD = Math.max(1, Math.round((rows[rows.length - 1].dt - dtTroca) / 86400000) + 1);
          const rrA = antes.reduce((s, r) => s + r.un, 0) / dA;
          const rrD = depois.reduce((s, r) => s + r.un, 0) / dD;
          const quedaPct = rrA > 0 ? ((rrD - rrA) / rrA) * 100 : 0;
          const precoA = median(antes.map((r) => r.preco).filter((x) => x > 0));
          const precoD = median(depois.map((r) => r.preco).filter((x) => x > 0));
          const precoPct = precoA && precoD ? ((precoD - precoA) / precoA) * 100 : 0;
          // alerta = queda >=15% ; melhora = subiu >=15% (base mínima antes)
          const baseOk = rrA >= 0.2;
          const alerta = baseOk && quedaPct <= -15;
          const melhora = baseOk && quedaPct >= 15;
          const precoMudou = Math.abs(precoPct) > 5;
          tituloDiag = {
            dtTroca, tituloAntigo: antes[antes.length - 1].titulo, tituloNovo: novoTit,
            rrA, rrD, quedaPct, precoA, precoD, precoPct, alerta, melhora, precoMudou,
            // veredito de queda: se preço mudou junto, causa provável é o preço
            causaProvavel: !alerta ? null : (precoMudou ? "preco" : "titulo"),
            // veredito de melhora: preço estável -> título ajudou; preço caiu -> pode ser o preço
            causaMelhora: !melhora ? null : (precoMudou && precoPct < 0 ? "preco" : "titulo"),
          };
        }
      }
    }

    // ---- quantidade sugerida de compra (ajustada por tendência) ----
    // Base do run rate: se está crescendo, usa a velocidade recente (2ª metade),
    // que é mais alta e realista, em vez da média histórica.
    // Folga: 20% base + folga de tendência proporcional ao crescimento, teto +100%.
    // Em queda, mantém o piso de 20% (nunca compra menos que isso).
    let qtdSugerida = null, rrBase = runRate, folgaTotal = margem;
    if (runRate > 0) {
      rrBase = emCrescimento ? Math.max(runRate, rrH2) : runRate;
      if (emCrescimento) {
        // folga extra = metade da taxa de crescimento (ex.: +60% cresc -> +30% extra)
        const extra = Math.min(1 - margem, (tendPct / 100) * 0.5); // teto: folga total = 100%
        folgaTotal = margem + Math.max(0, extra);
      } else {
        folgaTotal = margem; // estável ou em queda: piso de 20%
      }
      const alvo = rrBase * coberturaDias * (1 + folgaTotal);
      const saldoAtual = bal != null && bal > 0 ? bal : 0;
      qtdSugerida = Math.max(0, Math.ceil(alvo - saldoAtual));
    }

    return { ...o, runRate, rrH1, rrH2, tendPct, emCrescimento, emQueda, tendConfiavel, bal, ruptura, trocaTitulo, dropPct, queda, diasZero, dataZero, dataPedido, lead, priceChg, nTitulos: o.titulos.size, titulosArr: [...o.titulos], tituloDiag, qtdSugerida, folgaTotal, rrBase, marcaEstoque: marcaPorSku.get(o.sku) || "" };
  });

  // ---- ABC (both criteria precomputed) ----
  function abc(key) {
    const arr = list.filter((o) => o[key] > 0).sort((a, b) => b[key] - a[key]);
    const tot = arr.reduce((a, b) => a + b[key], 0);
    let cum = 0; const cls = new Map();
    for (const o of arr) { cum += o[key]; const c = cum / tot; cls.set(o.sku, c <= 0.8 ? "A" : c <= 0.95 ? "B" : "C"); }
    return cls;
  }
  const abcFat = abc("fat"), abcVol = abc("un");
  list.forEach((o) => { o.classeFat = abcFat.get(o.sku) || "C"; o.classeVol = abcVol.get(o.sku) || "C"; });

  // alerts: ruptura, queda de velocidade, OU queda após troca de título
  const alertas = list
    .filter((o) => {
      const td = o.tituloDiag;
      return (o.queda || o.ruptura || (td && td.alerta)) && o.un >= 3;
    })
    .map((o) => {
      const motivos = [];
      const td = o.tituloDiag;
      if (o.ruptura) motivos.push({ t: "Falta de estoque", cor: "vermelho" });
      if (td && td.alerta) {
        if (td.causaProvavel === "preco")
          motivos.push({ t: `Queda pós-troca — provável causa: preço (${td.precoPct > 0 ? "+" : ""}${td.precoPct.toFixed(0)}%)`, cor: "dourado" });
        else
          motivos.push({ t: "Queda após troca de título", cor: "azul" });
      } else if (o.trocaTitulo) {
        motivos.push({ t: "Troca de título (sem queda)", cor: "cinza" });
      }
      if (o.queda && !o.ruptura && !(td && td.alerta)) motivos.push({ t: "Queda de velocidade", cor: "dourado" });
      return { ...o, motivos };
    })
    .sort((a, b) => (b.ruptura - a.ruptura) || (b.fat - a.fat));

  // sucessos: troca de título que aumentou as vendas/visibilidade
  const sucessos = list
    .filter((o) => o.tituloDiag && o.tituloDiag.melhora && o.un >= 3)
    .sort((a, b) => b.tituloDiag.quedaPct - a.tituloDiag.quedaPct);

  // ---- SUGESTÕES DE APRIMORAMENTO DE TÍTULO ----
  // Aponta produtos que valem testar um novo título, com motivo e prioridade.
  function sugerirTitulo(titulo, marca) {
    // heurística simples de melhoria: completa com marca e reforça padrão de busca
    const t = (titulo || "").trim();
    const dicas = [];
    if (t.length < 40) dicas.push("título curto — adicione modelo, ano e compatibilidade");
    if (marca && !t.toLowerCase().includes(marca.toLowerCase()) && !/manete|999|inativo|ocupado|proje/i.test(marca))
      dicas.push(`inclua a marca "${marca}" no título`);
    if (!/\b(20\d{2}|1\d{3})\b/.test(t)) dicas.push("adicione o ano/geração compatível");
    if (!/(cg|cb|xre|bros|fazer|nmax|pcx|biz|factor|titan|fan|ninja|mt|hornet|xj6)/i.test(t))
      dicas.push("cite o modelo da moto para aparecer em buscas");
    return dicas;
  }

  const sugestoesTitulo = list
    .map((o) => {
      const motivos = [];
      let prioridade = 0;
      const td = o.tituloDiag;
      // 1) caiu após uma troca de título de teste
      if (td && td.alerta && td.causaProvavel === "titulo") {
        motivos.push({ t: `Caiu ${Math.abs(td.quedaPct).toFixed(0)}% após troca de título`, cor: "vermelho" });
        prioridade += 100;
      }
      // 2) perdeu desempenho (tendência de queda) com base relevante
      if (o.emQueda && o.un >= 10) {
        motivos.push({ t: `Vendas desacelerando ${o.tendPct.toFixed(0)}%`, cor: "dourado" });
        prioridade += 50;
      }
      // 3) estoque alto e venda baixa (precisa girar)
      if (o.bal != null && o.bal >= 50 && o.runRate < 0.3) {
        motivos.push({ t: "Estoque alto e pouca saída", cor: "azul" });
        prioridade += 30;
      }
      // 4) título curto/incompleto
      const dicas = sugerirTitulo(o.titulo, o.marcaEstoque);
      if (dicas.length >= 2 && o.un >= 2) {
        motivos.push({ t: "Título pode melhorar em busca", cor: "cinza" });
        prioridade += 10;
      }
      return { ...o, motivosTitulo: motivos, prioridadeTitulo: prioridade, dicasTitulo: dicas };
    })
    .filter((o) => o.motivosTitulo.length > 0)
    .sort((a, b) => b.prioridadeTitulo - a.prioridadeTitulo);


  // compras: tem saldo + run rate; ordenar por urgência (dataPedido mais próxima/vencida)
  const compras = list
    .filter((o) => o.bal != null && o.runRate > 0)
    .map((o) => {
      const hoje = maxD;
      const vencido = o.dataPedido && o.dataPedido < hoje;
      const urg = o.dataPedido ? (o.dataPedido - hoje) / 86400000 : 1e9;
      return { ...o, vencido, urg };
    })
    .sort((a, b) => a.urg - b.urg);

  // recomendados p/ comprar: curva A ou B, em ruptura OU acabando em <=30 dias
  const recomendados = compras
    .filter((o) => {
      const classeA_B = o.classeFat === "A" || o.classeFat === "B" || o.classeVol === "A" || o.classeVol === "B";
      const risco = o.bal <= 0 || (o.diasZero != null && o.diasZero <= 30);
      return classeA_B && risco;
    })
    .map((o) => {
      const nivel = o.bal <= 0 ? "critico" : o.vencido ? "critico" : o.diasZero <= 15 ? "urgente" : "atencao";
      return { ...o, nivel };
    })
    .sort((a, b) => a.urg - b.urg);

  // "abra o olho": ainda TEM estoque (saldo>0) mas já entrou na zona de pedido
  // (data ideal do pedido já chegou/passou). Curva A ou B.
  const abraOlho = compras
    .filter((o) => {
      const classeA_B = o.classeFat === "A" || o.classeFat === "B" || o.classeVol === "A" || o.classeVol === "B";
      return classeA_B && o.bal > 0 && o.vencido;
    })
    .map((o) => ({ ...o, nivel: "atencao" }))
    .sort((a, b) => a.urg - b.urg);

  // e os que já esgotaram (saldo <= 0), curva A ou B
  const esgotados = recomendados.filter((o) => o.bal <= 0);
  // ainda com estoque mas acabando em <=30 dias (não vencido ainda)
  const chegandoNoLimite = recomendados.filter((o) => o.bal > 0 && !o.vencido);

  const totFat = list.reduce((a, b) => a + Math.max(0, b.fat), 0);
  const totUn = list.reduce((a, b) => a + b.un, 0);
  const nRuptura = list.filter((o) => o.ruptura).length;
  const nProxFim = compras.filter((o) => o.bal > 0 && o.diasZero != null && o.diasZero <= 15).length;

  const abcDist = (key) => ["A", "B", "C"].map((c) => ({
    classe: c,
    qtd: list.filter((o) => o[key] === c).length,
    valor: list.filter((o) => o[key] === c).reduce((a, b) => a + (key === "classeFat" ? b.fat : b.un), 0),
  }));

  return {
    list, alertas, sucessos, sugestoesTitulo, compras, recomendados, esgotados, abraOlho, chegandoNoLimite,
    days, minD, maxD, hasStock, coberturaDias, margem, fonteEstoque,
    kpis: { totFat, totUn, nRuptura, nProxFim, nSku: list.length, nRecomendados: recomendados.length, nSucessos: sucessos.length, nAbraOlho: abraOlho.length, nEsgotados: esgotados.length },
    abcDistFat: abcDist("classeFat"), abcDistVol: abcDist("classeVol"),
    nOficial: list.filter((o) => o.oficial).length,
  };
}

// Converte linhas vindas da API do ML (já normalizadas pela rota /api/ml/sync)
// para o mesmo shape que o parser de Excel entrega.
export function mlRowsToVendas(rows) {
  return rows.map((r) => ({
    "SKU": r.sku,
    "# de anúncio": r.mlb,
    "Título do anúncio": r.titulo,
    "Data da venda": r.data,          // ISO; parseAnyDate cuida disso
    "Unidades": r.unidades,
    "Receita por produtos (BRL)": r.receita,
    "Cancelamentos e reembolsos (BRL)": 0,
    "Preço unitário de venda do anúncio (BRL)": r.preco,
    "Loja oficial": r.oficial || "",
  }));
}