"use client";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { analyze, readSheetSmart, mlRowsToVendas, brl, brlc, dstr } from "@/lib/analysis";
import EstoqueScreen from "@/components/EstoqueScreen";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Upload, TrendingDown, TrendingUp, Package, AlertTriangle, DollarSign, Boxes,
  RefreshCw, ShoppingCart, Clock, Tag, ChevronDown, ChevronRight, Layers, Eye,
  Lock, Unlock, LogOut, Cloud, FileSpreadsheet, ShieldAlert, Warehouse, Menu,
} from "lucide-react";

// ---------------- UI atoms ----------------
const CLS_COLOR = { A: "#1A3FB0", B: "#FFC107", C: "#B8B2A6" };
const MOTIVO_COLOR = { vermelho: "bg-red-100 text-red-700", azul: "bg-blue-100 text-blue-700", dourado: "bg-amber-100 text-amber-800", cinza: "bg-slate-100 text-slate-500" };

function KpiCard({ icon: Icon, label, value, sub, tone = "slate" }: any) {
  const tones = {
    slate: "text-slate-900", blue: "text-blue-700", red: "text-red-600", amber: "text-amber-600", green: "text-emerald-600",
  };
  return (
    <div className="flex-1 min-w-[170px] bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide">
        <Icon size={15} /> {label}
      </div>
      <div className={`text-3xl font-bold mt-2 ${tones[tone]}`} style={{ fontFamily: "Georgia, serif" }}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function Dropzone({ title, hint, fileName, onFile, tone }: any) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const color = tone === "blue" ? "blue" : "red";
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
      className={`flex-1 min-w-[300px] bg-white rounded-2xl p-6 border-2 border-dashed transition
        ${drag ? "border-slate-800 bg-slate-50" : fileName ? `border-${color}-400` : "border-slate-200"}`}
    >
      <div className="flex items-center justify-between">
        <div className="font-bold text-slate-800">{title}</div>
        {fileName && <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> carregado</span>}
      </div>
      <div className="text-[13px] text-slate-500 mt-1 mb-3">{hint}</div>
      {fileName && <div className="text-xs text-slate-700 mb-3 break-all flex items-center gap-1"><Package size={13} /> {fileName}</div>}
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      <button onClick={() => ref.current.click()}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold border
          ${fileName ? `text-${color}-700 border-${color}-500 bg-white` : `text-white bg-${color}-600 border-${color}-600`}`}>
        {fileName ? <RefreshCw size={15} /> : <Upload size={15} />}
        {fileName ? "Fazer outro upload" : "Selecionar ou arrastar"}
      </button>
    </div>
  );
}

const Th = ({ children, right }: any) => (
  <th className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 ${right ? "text-right" : "text-left"}`}>{children}</th>
);
const ClsBadge = ({ c }: any) => (
  <span className="inline-block text-white text-[11px] font-extrabold px-2 py-0.5 rounded"
    style={{ background: CLS_COLOR[c], color: c === "B" ? "#101820" : "#fff" }}>{c}</span>
);
// selo de tendência de vendas
const TrendBadge = ({ o, compact }: any) => {
  if (!o.tendConfiavel) return compact ? null : <span className="text-slate-300 text-xs">—</span>;
  if (o.emCrescimento) return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded" title={`Vendas acelerando ${o.tendPct.toFixed(0)}% — compra reforçada`}>
      <TrendingUp size={12} /> +{o.tendPct.toFixed(0)}%
    </span>
  );
  if (o.emQueda) return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded" title={`Vendas desacelerando ${o.tendPct.toFixed(0)}%`}>
      <TrendingDown size={12} /> {o.tendPct.toFixed(0)}%
    </span>
  );
  return compact ? <span className="text-slate-400 text-[11px]">estável</span> : <span className="text-slate-400 text-xs">estável</span>;
};

// filtro de curva reutilizável
function ClsFilter({ value, onChange, counts }: any) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {[["Todos", "Todos"], ["A", "Curva A"], ["B", "Curva B"], ["C", "Curva C"]].map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`px-3 py-1.5 rounded-lg text-[13px] font-bold border transition
            ${value === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
          {l}{counts && counts[k] != null ? ` (${counts[k]})` : ""}
        </button>
      ))}
    </div>
  );
}

// ---------------- main ----------------

export default function Dashboard({ role, email, initialLocked }) {
  const router = useRouter();
  const supabase = createClient();
  const [fonte, setFonte] = useState('upload'); // 'upload' | 'ml'
  const [locked, setLocked] = useState(initialLocked);
  const [lockBusy, setLockBusy] = useState(false);
  const [mlBusy, setMlBusy] = useState(false);
  const [mlMsg, setMlMsg] = useState('');

  const [vendasRaw, setVendasRaw] = useState(null);
  const [estoqueRaw, setEstoqueRaw] = useState(null);
  const [vName, setVName] = useState(""), [eName, setEName] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [abcMode, setAbcMode] = useState("fat"); // fat | vol
  const [leadOff, setLeadOff] = useState(90), [leadOutro, setLeadOutro] = useState(7);
  const [expand, setExpand] = useState(null);
  const [tela, setTela] = useState("dashboard"); // dashboard | comprar
  const [fCompras, setFCompras] = useState("Todos");
  const [fRecom, setFRecom] = useState("Todos");
  const [fAlertas, setFAlertas] = useState("Todos");
  const [cobertura, setCobertura] = useState(90); // dias de venda que cada pedido cobre
  const [periodoDias, setPeriodoDias] = useState(30); // filtro de período do ML (0=total)
  const [vendasHoje, setVendasHoje] = useState([]); // vendas de hoje agrupadas por produto
  const [produtosSupabase, setProdutosSupabase] = useState<any[]>([]); // estoque do banco

  // carrega o estoque do Supabase ao abrir (fonte principal da sugestão de compra)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/estoque");
        const j = await r.json();
        if (r.ok && j.produtos) setProdutosSupabase(j.produtos);
      } catch { /* se falhar, cai na planilha */ }
    })();
  }, []);

  const readFile = useCallback((file, wanted, setRaw, setName) => {
    setErr(""); setBusy(true);
    const rd = new FileReader();
    rd.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        setRaw(readSheetSmart(wb, wanted)); setName(file.name);
      } catch (ex) { setErr("Falha ao ler: " + ex.message); }
      setBusy(false);
    };
    rd.onerror = () => { setErr("Não consegui abrir o arquivo."); setBusy(false); };
    rd.readAsArrayBuffer(file);
  }, []);

  // ---- sincronizar via API do Mercado Livre ----
  const syncML = useCallback(async (dias) => {
    setMlBusy(true); setMlMsg("");
    try {
      const r = await fetch(`/api/ml/sync?dias=${dias}`);
      const j = await r.json();
      if (!r.ok || j.error) {
        setMlMsg(j.error === "sem_conexao_ml"
          ? "Conecte sua conta do Mercado Livre primeiro (botão abaixo)."
          : "Erro ao sincronizar: " + (j.error || r.status));
      } else {
        const rows = mlRowsToVendas(j.rows);
        setVendasRaw(rows);
        const label = dias === 0 ? "período total disponível" : `últimos ${dias} dias`;
        setVName(`Mercado Livre — ${j.count} vendas (${label})`);
        setMlMsg(`Sincronizado: ${j.count} itens de venda dos ${label}.`);

        // ---- vendas de HOJE, agrupadas por produto (acumulado) ----
        // "hoje" no fuso do Brasil (America/Sao_Paulo), pra não errar perto da meia-noite
        const hojeBR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD
        const mapa = new Map();
        for (const v of (j.rows || [])) {
          if (!v.data) continue;
          const diaBR = new Date(v.data).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          if (diaBR !== hojeBR) continue;
          const key = v.sku || v.mlb || v.titulo;
          let o = mapa.get(key);
          if (!o) { o = { sku: v.sku, titulo: v.titulo, unidades: 0, receita: 0 }; mapa.set(key, o); }
          o.unidades += Number(v.unidades) || 0;
          o.receita += Number(v.receita) || 0;
          if (v.titulo) o.titulo = v.titulo;
        }
        const lista = [...mapa.values()].sort((a, b) => b.unidades - a.unidades);
        setVendasHoje(lista);

        // ---- baixa automática de estoque (pedidos novos, de hoje em diante) ----
        try {
          const pedidos = (j.rows || [])
            .filter((v: any) => v.order_id && v.sku)
            .map((v: any) => ({ order_id: v.order_id, sku: v.sku, quantidade: v.unidades, data: v.data }));
          if (pedidos.length) {
            const rb = await fetch("/api/baixa", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pedidos }),
            });
            const jb = await rb.json();
            if (rb.ok && jb.pedidosDescontados > 0) {
              setMlMsg(`Sincronizado: ${j.count} itens. Baixa automática: ${jb.itensDescontados} itens descontados de ${jb.pedidosDescontados} pedidos novos.`);
              // recarrega o estoque do Supabase pra refletir o novo saldo
              try {
                const re = await fetch("/api/estoque");
                const je = await re.json();
                if (re.ok && je.produtos) setProdutosSupabase(je.produtos);
              } catch {}
            }
          }
        } catch { /* baixa é best-effort; não bloqueia a sincronização */ }
      }
    } catch (e) { setMlMsg("Falha de rede ao sincronizar."); }
    setMlBusy(false);
  }, []);

  // ---- admin: travar / destravar o app para todos ----
  const toggleLock = useCallback(async () => {
    setLockBusy(true);
    try {
      const r = await fetch("/api/lock", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !locked }),
      });
      const j = await r.json();
      if (r.ok) setLocked(j.locked);
    } finally { setLockBusy(false); }
  }, [locked]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }, [router, supabase]);

  const R = useMemo(() => {
    if (!vendasRaw) return null;
    try { return analyze(vendasRaw, estoqueRaw, { leadOff, leadOutro, coberturaDias: cobertura, margem: 0.2, produtosSupabase }); }
    catch (ex) { return { error: ex.message }; }
  }, [vendasRaw, estoqueRaw, leadOff, leadOutro, cobertura, produtosSupabase]);

  const abcDist = R && !R.error ? (abcMode === "fat" ? R.abcDistFat : R.abcDistVol) : [];
  const classeKey = abcMode === "fat" ? "classeFat" : "classeVol";

  // aplica filtro de curva sobre uma lista, usando a classe do modo ABC atual
  const byClass = (arr, f) => (!arr ? [] : (f === "Todos" ? arr : arr.filter((o) => o[classeKey] === f)));
  const classCounts = (arr) => {
    if (!arr) return {};
    const c = { Todos: arr.length, A: 0, B: 0, C: 0 };
    arr.forEach((o) => { c[o[classeKey]] = (c[o[classeKey]] || 0) + 1; });
    return c;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      {/* ===== MENU LATERAL FIXO ===== */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col fixed h-screen">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="text-lg font-extrabold leading-tight" style={{ fontFamily: "Georgia, serif" }}>
            Speed Bikers
          </div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Gestão de Compras</div>
        </div>

        {/* navegação principal */}
        <nav className="px-3 py-4 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-3 mb-2">Menu</div>
          {[
            ["dashboard", "Dashboard", Layers],
            ["comprar", "Comprar agora", ShoppingCart],
            ["aprimorar", "Sugestões de aprimoramento", TrendingUp],
            ["estoque", "Estoque", Warehouse],
          ].map(([k, l, Ic]: any) => (
            <button key={k} onClick={() => setTela(k)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold mb-1 transition text-left
                ${tela === k ? "bg-sbblue text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <Ic size={17} /> {l}
              {k === "comprar" && R && !R.error && R.kpis.nRecomendados > 0 && (
                <span className={`ml-auto text-[11px] font-extrabold px-1.5 py-0.5 rounded-full ${tela === k ? "bg-white text-sbblue" : "bg-red-100 text-red-700"}`}>{R.kpis.nRecomendados}</span>
              )}
            </button>
          ))}

          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-3 mb-2 mt-6">Fonte de dados</div>
          <button onClick={() => setFonte("upload")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold mb-1 transition text-left
              ${fonte === "upload" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100"}`}>
            <FileSpreadsheet size={17} /> Upload de Excel
          </button>
          <button onClick={() => setFonte("ml")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition text-left
              ${fonte === "ml" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100"}`}>
            <Cloud size={17} /> Mercado Livre
          </button>
        </nav>

        {/* rodapé do menu: usuário + ações */}
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="px-3 mb-2">
            <div className="text-xs font-semibold text-slate-700 truncate">{email}</div>
            <div className="text-[11px] text-slate-400">{role === "admin" ? "Administrador" : "Usuário"}</div>
          </div>
          {role === "admin" && (
            <button onClick={toggleLock} disabled={lockBusy}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold mb-1 border transition
                ${locked ? "bg-sbred text-white border-sbred" : "bg-white text-sbred border-red-200 hover:bg-red-50"}`}>
              {locked ? <><Unlock size={15} /> Desbloquear</> : <><Lock size={15} /> Bloquear app</>}
            </button>
          )}
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold text-slate-500 hover:bg-slate-100 transition">
            <LogOut size={15} /> Sair
          </button>
        </div>
      </aside>

      {/* ===== CONTEÚDO ===== */}
      <main className="flex-1 ml-60 min-h-screen">
        <div className="max-w-6xl mx-auto px-8 py-8 pb-20">
          {/* título da tela atual */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
              {tela === "dashboard" ? "Dashboard" : tela === "comprar" ? "Comprar agora" : tela === "aprimorar" ? "Sugestões de aprimoramento" : "Estoque"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {tela === "dashboard" ? "Curva ABC, alertas e saúde dos produtos" :
               tela === "comprar" ? "Recomendações de reposição por urgência" :
               tela === "aprimorar" ? "Produtos que valem testar um novo título" :
               "Controle de estoque, marcas e custos"}
            </p>
          </div>

          {role === "admin" && locked && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5 flex items-center gap-2">
              <ShieldAlert size={16} /> O app está <b>bloqueado</b> para os demais usuários. Você (admin) continua com acesso.
            </div>
          )}

        {/* fontes de dados só nas telas que usam vendas */}
        {(tela === "dashboard" || tela === "comprar") && (<>
        {/* ===== fonte: upload ===== */}
        {fonte === "upload" && (
          <div className="flex gap-4 flex-wrap mb-6">
            <Dropzone tone="blue" title="Planilha de Vendas (obrigatória)"
              hint="Relatório do Mercado Livre. Localizo o cabeçalho automaticamente."
              fileName={vName}
              onFile={(f) => readFile(f, ["N.º de venda", "SKU", "Título do anúncio", "Unidades"], setVendasRaw, setVName)} />
            <Dropzone tone="red" title="Planilha de Estoque (Upseller)"
              hint="Movimentações de estoque. O Upseller ainda não tem API, então o estoque vem sempre por upload."
              fileName={eName}
              onFile={(f) => readFile(f, ["Tempo", "SKU", "Novo Estoque Atual"], setEstoqueRaw, setEName)} />
          </div>
        )}

        {/* ===== fonte: Mercado Livre ===== */}
        {fonte === "ml" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-1"><Cloud size={18} className="text-sbblue" /> Dados em tempo real do Mercado Livre</div>
            <p className="text-sm text-slate-500 mb-4">Puxa suas vendas direto da API. O estoque continua vindo do upload do Upseller (que ainda não tem API).</p>

            {/* filtro de período */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-500 mb-1.5">Período das vendas</div>
              <div className="flex items-center bg-slate-100 rounded-lg p-1 w-fit flex-wrap">
                {([[7, "7 dias"], [30, "30 dias"], [60, "60 dias"], [90, "90 dias"], [0, "Total"]] as any[]).map(([d, l]) => (
                  <button key={d} onClick={() => setPeriodoDias(Number(d))}
                    className={`px-3 py-1.5 rounded-md text-[13px] font-bold transition ${periodoDias === d ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>{l}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button onClick={() => syncML(periodoDias)} disabled={mlBusy}
                className="flex items-center gap-2 bg-sbblue text-white font-bold rounded-lg px-4 py-2 disabled:opacity-60">
                <RefreshCw size={16} className={mlBusy ? "animate-spin" : ""} /> Sincronizar vendas
              </button>
              <a href="/api/ml/authorize"
                className="flex items-center gap-2 bg-white text-sbblue font-bold rounded-lg px-4 py-2 border border-sbblue">
                <Cloud size={16} /> Conectar conta do Mercado Livre
              </a>
            </div>
            {mlMsg && <div className="text-sm mt-3 text-slate-700 bg-slate-100 rounded-lg px-3 py-2">{mlMsg}</div>}
            {periodoDias === 0 && (
              <div className="text-xs text-amber-600 mt-2">O período "Total" busca o máximo que a API do Mercado Livre permite (até ~10.000 pedidos) e pode demorar mais.</div>
            )}

            {/* vendas de hoje (acumulado por produto) */}
            {vendasHoje.length > 0 ? (
              <div className="mt-5 border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <ShoppingCart size={16} className="text-sbblue" /> Vendas de hoje
                    <span className="text-xs font-normal text-slate-400">
                      {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-700">
                    {vendasHoje.reduce((a, b) => a + b.unidades, 0)} un · {brl(vendasHoje.reduce((a, b) => a + b.receita, 0))}
                  </div>
                </div>
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-white sticky top-0"><tr>
                      <Th>SKU</Th><Th>Produto</Th><Th right>Vendidos hoje</Th><Th right>Faturamento</Th>
                    </tr></thead>
                    <tbody>
                      {vendasHoje.map((v, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                          <td className="px-3 py-2 max-w-[320px] truncate" title={v.titulo}>{v.titulo || "—"}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900">{v.unidades}</td>
                          <td className="px-3 py-2 text-right font-semibold">{brlc(v.receita)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : vName ? (
              <div className="mt-5 border border-slate-200 rounded-xl px-4 py-5 text-center text-sm text-slate-500">
                Nenhuma venda registrada hoje ainda. Conforme as vendas entrarem no Mercado Livre, sincronize para atualizar.
              </div>
            ) : null}

            <div className="mt-4">
              <Dropzone tone="red" title="Planilha de Estoque (Upseller) — necessária para reposição"
                hint="Mesmo em tempo real, o estoque vem do upload."
                fileName={eName}
                onFile={(f) => readFile(f, ["Tempo", "SKU", "Novo Estoque Atual"], setEstoqueRaw, setEName)} />
            </div>
          </div>
        )}
        </>)}

        {busy && <div className="text-blue-700 font-semibold mb-3 flex items-center gap-2"><RefreshCw size={16} className="animate-spin" /> Processando…</div>}
        {err && <div className="text-red-600 font-semibold mb-3">{err}</div>}

        {!vendasRaw && !busy && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Carregue a planilha de vendas para gerar o dashboard. O processamento é 100% no seu navegador.
          </div>
        )}
        {R?.error && <div className="text-red-600 font-semibold">Erro: {R.error}</div>}

        {R && !R.error && (tela === "dashboard" || tela === "comprar") && (
          <>
            {/* KPIs */}
            <div className="flex gap-4 flex-wrap mb-4">
              <KpiCard icon={DollarSign} label="Faturamento" value={brl(R.kpis.totFat)} tone="blue" sub={`${R.days} dias · ${dstr(R.minD)}–${dstr(R.maxD)}`} />
              <KpiCard icon={Boxes} label="Itens vendidos" value={R.kpis.totUn.toLocaleString("pt-BR")} sub={`${R.kpis.nSku} SKUs ativos`} />
              <KpiCard icon={AlertTriangle} label="Em ruptura" value={R.kpis.nRuptura} tone="red" sub="saldo atual zerado" />
              <KpiCard icon={Clock} label="Próximos do fim" value={R.kpis.nProxFim} tone="amber" sub="acabam em ≤15 dias" />
            </div>

            {!R.hasStock && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm mb-5">
                Sem estoque disponível: ruptura, saldo e reposição ficam indisponíveis. Cadastre produtos na tela Estoque ou suba a planilha do Upseller.
              </div>
            )}

            {tela === "dashboard" && (<>
            {/* ABC section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Layers size={18} /> Curva ABC
                </div>
                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                  {[["fat", "Faturamento"], ["vol", "Volume"]].map(([k, l]) => (
                    <button key={k} onClick={() => setAbcMode(k)}
                      className={`px-4 py-1.5 rounded-md text-[13px] font-bold transition ${abcMode === k ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 items-center">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={abcDist} dataKey="qtd" nameKey="classe" cx="50%" cy="50%" outerRadius={85} innerRadius={45}
                      label={(e) => `${e.classe}: ${e.qtd}`}>
                      {abcDist.map((d) => <Cell key={d.classe} fill={CLS_COLOR[d.classe]} />)}
                    </Pie>
                    <Tooltip formatter={(v, _n, p) => [`${v} SKUs`, `Classe ${p.payload.classe}`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {abcDist.map((d) => (
                    <div key={d.classe} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                      <span className="w-3 h-3 rounded-full" style={{ background: CLS_COLOR[d.classe] }} />
                      <span className="font-bold w-16">Classe {d.classe}</span>
                      <span className="text-slate-600 text-sm">{d.qtd} SKUs</span>
                      <span className="ml-auto text-slate-500 text-sm">
                        {abcMode === "fat" ? brl(d.valor) : `${d.valor.toLocaleString("pt-BR")} un.`}
                      </span>
                    </div>
                  ))}
                  <div className="text-xs text-slate-400 pt-1">Corte clássico: A = 80% do topo · B = próximos 15% · C = últimos 5%.</div>
                </div>
              </div>
            </div>

            {/* ALERTAS */}
            <div className="bg-white rounded-2xl border border-slate-200 mb-6 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-wrap">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <TrendingDown size={18} className="text-red-500" /> Alertas — produtos com queda ou risco
                </div>
                <div className="ml-auto"><ClsFilter value={fAlertas} onChange={setFAlertas} counts={classCounts(R.alertas)} /></div>
              </div>
              {byClass(R.alertas, fAlertas).length === 0 ? (
                <div className="px-5 py-6 text-slate-500 text-sm">Nenhum alerta relevante nesta curva.</div>
              ) : (
                <div className="max-h-[440px] overflow-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-slate-50 sticky top-0"><tr>
                      <Th>Classe</Th><Th>SKU</Th><Th>Produto</Th><Th>Motivo</Th>
                      <Th right>Run rate</Th><Th right>Saldo</Th><Th></Th>
                    </tr></thead>
                    <tbody>
                      {byClass(R.alertas, fAlertas).slice(0, 200).map((o) => (
                        <React.Fragment key={o.sku}>
                          <tr className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2.5"><ClsBadge c={o[classeKey]} /></td>
                            <td className="px-3 py-2.5 font-mono text-xs">{o.sku}</td>
                            <td className="px-3 py-2.5 max-w-[280px] truncate" title={o.titulo}>{o.titulo || "—"}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-1 flex-wrap">
                                {o.motivos.map((m, i) => <span key={i} className={`text-[11px] font-bold px-2 py-0.5 rounded ${MOTIVO_COLOR[m.cor]}`}>{m.t}</span>)}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold">{o.runRate.toFixed(2)}/dia</td>
                            <td className="px-3 py-2.5 text-right">{o.bal == null ? "—" : o.bal}</td>
                            <td className="px-3 py-2.5 text-right">
                              {o.trocaTitulo && (
                                <button onClick={() => setExpand(expand === o.sku ? null : o.sku)} className="text-blue-600">
                                  {expand === o.sku ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expand === o.sku && o.trocaTitulo && (
                            <tr className="bg-blue-50/40 border-b border-slate-100">
                              <td colSpan={7} className="px-4 py-3">
                                {o.tituloDiag ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[13px]">
                                      <Tag size={13} className="text-slate-500" />
                                      <span className="text-slate-500">Título mudou em</span>
                                      <span className="font-bold">{dstr(o.tituloDiag.dtTroca)}</span>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-3 text-[13px]">
                                      <div className="bg-white rounded-lg border border-slate-200 p-3">
                                        <div className="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Antes</div>
                                        <div className="text-slate-700 mb-1.5">{o.tituloDiag.tituloAntigo}</div>
                                        <div className="text-slate-500">{o.tituloDiag.rrA.toFixed(2)} vendas/dia · preço {o.tituloDiag.precoA ? brlc(o.tituloDiag.precoA) : "—"}</div>
                                      </div>
                                      <div className="bg-white rounded-lg border border-slate-200 p-3">
                                        <div className="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Depois</div>
                                        <div className="text-slate-700 mb-1.5">{o.tituloDiag.tituloNovo}</div>
                                        <div className="text-slate-500">{o.tituloDiag.rrD.toFixed(2)} vendas/dia · preço {o.tituloDiag.precoD ? brlc(o.tituloDiag.precoD) : "—"}</div>
                                      </div>
                                    </div>
                                    {o.tituloDiag.alerta ? (
                                      <div className={`rounded-lg px-3 py-2.5 text-[13px] font-semibold ${o.tituloDiag.causaProvavel === "preco" ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-blue-50 text-blue-800 border border-blue-200"}`}>
                                        Vendas caíram {Math.abs(o.tituloDiag.quedaPct).toFixed(0)}% após a troca.{" "}
                                        {o.tituloDiag.causaProvavel === "preco"
                                          ? `Mas o preço também mudou ${o.tituloDiag.precoPct > 0 ? "+" : ""}${o.tituloDiag.precoPct.toFixed(0)}% no mesmo período — a causa provável é o preço, não o título.`
                                          : `O preço ficou praticamente estável (${o.tituloDiag.precoPct > 0 ? "+" : ""}${o.tituloDiag.precoPct.toFixed(0)}%), então a troca de título é a causa provável da queda.`}
                                      </div>
                                    ) : o.tituloDiag.melhora ? (
                                      <div className="rounded-lg px-3 py-2.5 text-[13px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        Vendas subiram {o.tituloDiag.quedaPct.toFixed(0)}% após a troca.{" "}
                                        {o.tituloDiag.causaMelhora === "preco"
                                          ? `Mas o preço caiu ${o.tituloDiag.precoPct.toFixed(0)}% no mesmo período — parte do ganho pode ser do preço, não só do título.`
                                          : `O preço ficou estável (${o.tituloDiag.precoPct > 0 ? "+" : ""}${o.tituloDiag.precoPct.toFixed(0)}%), então o novo título melhorou a visibilidade e as vendas.`}
                                      </div>
                                    ) : (
                                      <div className="rounded-lg px-3 py-2.5 text-[13px] bg-slate-50 text-slate-600 border border-slate-200">
                                        Houve troca de título, mas sem variação relevante de vendas ({o.tituloDiag.quedaPct >= 0 ? "+" : ""}{o.tituloDiag.quedaPct.toFixed(0)}%).
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Tag size={12} /> Títulos usados no período:</div>
                                    <ul className="list-disc pl-5 text-[13px] space-y-1">
                                      {o.titulosArr.map((t, i) => <li key={i}>{t}</li>)}
                                    </ul>
                                  </>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SUCESSOS — troca de título que aumentou vendas */}
            {R.sucessos.length > 0 && (
              <div className="bg-white rounded-2xl border border-emerald-200 mb-6 overflow-hidden">
                <div className="flex items-center gap-2 font-bold text-slate-800 px-5 py-4 border-b border-emerald-100 bg-emerald-50/40">
                  <TrendingUp size={18} className="text-emerald-600" /> Trocas de título que deram certo
                  <span className="ml-2 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{R.sucessos.length}</span>
                </div>
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-slate-50 sticky top-0"><tr>
                      <Th>Classe</Th><Th>SKU</Th><Th>Produto (título atual)</Th>
                      <Th right>Antes</Th><Th right>Depois</Th><Th right>Ganho</Th>
                    </tr></thead>
                    <tbody>
                      {byClass(R.sucessos, "Todos").slice(0, 100).map((o) => (
                        <tr key={o.sku} className="border-b border-slate-100 hover:bg-emerald-50/30">
                          <td className="px-3 py-2.5"><ClsBadge c={o[classeKey]} /></td>
                          <td className="px-3 py-2.5 font-mono text-xs">{o.sku}</td>
                          <td className="px-3 py-2.5 max-w-[320px] truncate" title={o.tituloDiag.tituloNovo}>{o.tituloDiag.tituloNovo}</td>
                          <td className="px-3 py-2.5 text-right text-slate-500">{o.tituloDiag.rrA.toFixed(2)}/dia</td>
                          <td className="px-3 py-2.5 text-right font-semibold">{o.tituloDiag.rrD.toFixed(2)}/dia</td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-600">+{o.tituloDiag.quedaPct.toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 text-xs text-slate-400 border-t border-emerald-100">
                  Produtos cujas vendas/dia subiram ≥15% depois da troca de título. Clique em um alerta na tabela acima para ver o antes/depois completo com preço.
                </div>
              </div>
            )}

            {/* COMPRAS */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-3">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <ShoppingCart size={18} className="text-emerald-600" /> Sugestão de compras — reposição
                </div>
                <div className="flex items-center gap-4 text-[13px] flex-wrap">
                  <label className="flex items-center gap-1.5">
                    <span className="text-slate-500">Cobrir</span>
                    <input type="number" value={cobertura} onChange={(e) => setCobertura(Math.max(1, +e.target.value))}
                      className="w-16 border border-slate-300 rounded px-2 py-1 text-right" /> <span className="text-slate-400">dias de venda</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-slate-500">Lead OffRacer</span>
                    <input type="number" value={leadOff} onChange={(e) => setLeadOff(Math.max(0, +e.target.value))}
                      className="w-16 border border-slate-300 rounded px-2 py-1 text-right" /> <span className="text-slate-400">dias</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-slate-500">Lead outros</span>
                    <input type="number" value={leadOutro} onChange={(e) => setLeadOutro(Math.max(0, +e.target.value))}
                      className="w-16 border border-slate-300 rounded px-2 py-1 text-right" /> <span className="text-slate-400">dias</span>
                  </label>
                </div>
              </div>
              <div className="px-5 py-3 border-b border-slate-100"><ClsFilter value={fCompras} onChange={setFCompras} counts={classCounts(R.compras)} /></div>
              {byClass(R.compras, fCompras).length === 0 ? (
                <div className="px-5 py-6 text-slate-500 text-sm">Sem itens de reposição nesta curva.</div>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-slate-50 sticky top-0"><tr>
                      <Th>Classe</Th><Th>SKU</Th><Th>Produto</Th><Th>Marca</Th>
                      <Th right>Saldo</Th><Th right>Run rate</Th><Th>Tendência</Th><Th right>Dias p/ acabar</Th>
                      <Th right>Data ideal do pedido</Th><Th right>Qtd sugerida</Th>
                    </tr></thead>
                    <tbody>
                      {byClass(R.compras, fCompras).slice(0, 300).map((o) => (
                        <tr key={o.sku} className={`border-b border-slate-100 ${o.vencido || o.bal <= 0 ? "bg-red-50" : o.diasZero <= 15 ? "bg-amber-50" : "hover:bg-slate-50"}`}>
                          <td className="px-3 py-2.5"><ClsBadge c={o[classeKey]} /></td>
                          <td className="px-3 py-2.5 font-mono text-xs">{o.sku}</td>
                          <td className="px-3 py-2.5 max-w-[240px] truncate" title={o.titulo}>{o.titulo || "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${o.oficial ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                              {o.oficial ? "OffRacer" : "Outros"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold" style={{ color: o.bal <= 0 ? "#dc2626" : undefined }}>{o.bal}</td>
                          <td className="px-3 py-2.5 text-right">{o.runRate.toFixed(2)}/dia</td>
                          <td className="px-3 py-2.5"><TrendBadge o={o} /></td>
                          <td className="px-3 py-2.5 text-right">{o.diasZero == null ? "—" : o.diasZero <= 0 ? "esgotado" : Math.round(o.diasZero)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold" style={{ color: o.vencido ? "#dc2626" : o.diasZero <= 15 ? "#d97706" : "#059669" }}>
                            {o.vencido ? `${dstr(o.dataPedido)} (vencido)` : dstr(o.dataPedido)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="font-extrabold text-slate-900">{o.qtdSugerida != null ? o.qtdSugerida.toLocaleString("pt-BR") : "—"}</span>
                            {o.emCrescimento && <span className="block text-[10px] text-emerald-600 font-bold">reforçada +{Math.round(o.folgaTotal * 100)}%</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
                Qtd sugerida = (vendas/dia × {cobertura} dias × margem) − saldo atual. A margem começa em 20% e aumenta para produtos em crescimento
                (até dobrar a compra), usando a velocidade recente como base. Produtos em queda mantêm os 20%. {R.nOficial} de {R.kpis.nSku} SKUs são OffRacer.
              </div>
            </div>
            </>)}

            {/* ================= TELA: COMPRAR AGORA ================= */}
            {tela === "comprar" && (() => {
              // card reutilizável
              const Card = ({ o }: any) => {
                const cor = o.nivel === "critico" ? "#dc2626" : o.nivel === "urgente" ? "#f59e0b" : "#10b981";
                const rot = o.nivel === "critico" ? "Comprar já" : o.nivel === "urgente" ? "Urgente" : "Atenção";
                return (
                  <div className="bg-white rounded-xl border border-slate-200 p-4" style={{ borderLeft: `4px solid ${cor}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <ClsBadge c={o[classeKey]} />
                          <span className="font-mono text-xs text-slate-500">{o.sku}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${o.oficial ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{o.oficial ? "OffRacer" : "Outros"}</span>
                          <TrendBadge o={o} compact />
                        </div>
                        <div className="text-[13px] font-semibold text-slate-800 leading-snug line-clamp-2" title={o.titulo}>{o.titulo || "—"}</div>
                      </div>
                      <span className="shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-full text-white" style={{ background: cor }}>{rot}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                      <div className="bg-slate-50 rounded-lg py-2">
                        <div className="text-[10px] uppercase text-slate-400 font-bold">Saldo</div>
                        <div className={`text-lg font-bold ${o.bal <= 0 ? "text-red-600" : "text-slate-800"}`}>{o.bal}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg py-2">
                        <div className="text-[10px] uppercase text-slate-400 font-bold">Vende/dia</div>
                        <div className="text-lg font-bold text-slate-800">{o.runRate.toFixed(1)}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg py-2">
                        <div className="text-[10px] uppercase text-slate-400 font-bold">Dias p/ zerar</div>
                        <div className="text-lg font-bold text-slate-800">{o.diasZero <= 0 ? "0" : Math.round(o.diasZero)}</div>
                      </div>
                      <div className="rounded-lg py-2" style={{ background: "#ecfdf5" }}>
                        <div className="text-[10px] uppercase text-emerald-600 font-bold">Comprar</div>
                        <div className="text-lg font-extrabold text-emerald-700">{o.qtdSugerida != null ? o.qtdSugerida.toLocaleString("pt-BR") : "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-3 text-[13px]" style={{ color: o.vencido ? "#dc2626" : "#475569" }}>
                      <Clock size={14} />
                      <span className="font-semibold">Pedir até {dstr(o.dataPedido)}</span>
                      {o.vencido && <span className="font-bold text-red-600">· ponto de pedido já passou</span>}
                      <span className="text-slate-400 ml-auto">lead {o.lead}d</span>
                    </div>
                  </div>
                );
              };
              const esg = byClass(R.esgotados, fRecom);
              const olho = byClass(R.abraOlho, fRecom);
              const chegando = byClass(R.chegandoNoLimite, fRecom);

              return (
                <div>
                  {/* resumo topo */}
                  <div className="grid sm:grid-cols-3 gap-3 mb-5">
                    <div className="bg-gradient-to-br from-red-600 to-red-700 text-white rounded-2xl p-5">
                      <div className="flex items-center gap-2 text-red-100 text-xs font-semibold uppercase tracking-wide"><AlertTriangle size={14} /> Já esgotados</div>
                      <div className="text-3xl font-extrabold mt-1" style={{ fontFamily: "Georgia, serif" }}>{esg.length}</div>
                      <div className="text-red-100 text-xs mt-0.5">saldo zerado · comprar imediatamente</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl p-5">
                      <div className="flex items-center gap-2 text-amber-100 text-xs font-semibold uppercase tracking-wide"><Eye size={14} /> Abra o olho</div>
                      <div className="text-3xl font-extrabold mt-1" style={{ fontFamily: "Georgia, serif" }}>{olho.length}</div>
                      <div className="text-amber-100 text-xs mt-0.5">ainda tem estoque, mas já é hora de pedir</div>
                    </div>
                    <div className="bg-gradient-to-br from-slate-600 to-slate-700 text-white rounded-2xl p-5">
                      <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold uppercase tracking-wide"><Clock size={14} /> No radar</div>
                      <div className="text-3xl font-extrabold mt-1" style={{ fontFamily: "Georgia, serif" }}>{chegando.length}</div>
                      <div className="text-slate-200 text-xs mt-0.5">acabam em ≤30 dias, pedido ainda no prazo</div>
                    </div>
                  </div>

                  {/* controles */}
                  <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                    <ClsFilter value={fRecom} onChange={setFRecom} counts={classCounts([...R.esgotados, ...R.abraOlho, ...R.chegandoNoLimite])} />
                    <label className="flex items-center gap-1.5 text-[13px] bg-white border border-slate-200 rounded-lg px-3 py-2">
                      <ShoppingCart size={14} className="text-emerald-600" />
                      <span className="text-slate-500">Comprar p/ cobrir</span>
                      <input type="number" value={cobertura} onChange={(e) => setCobertura(Math.max(1, +e.target.value))}
                        className="w-16 border border-slate-300 rounded px-2 py-1 text-right font-semibold" />
                      <span className="text-slate-400">dias (+20% margem)</span>
                    </label>
                  </div>

                  {/* GRUPO 1: esgotados */}
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={17} className="text-red-600" />
                    <h3 className="font-bold text-slate-800">Já esgotados — comprar imediatamente</h3>
                    <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{esg.length}</span>
                  </div>
                  {esg.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm mb-8">Nenhum item esgotado nesta curva. 👍</div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-3 mb-8">{esg.map((o) => <Card key={o.sku} o={o} />)}</div>
                  )}

                  {/* GRUPO 2: abra o olho */}
                  <div className="flex items-center gap-2 mb-3">
                    <Eye size={17} className="text-amber-600" />
                    <h3 className="font-bold text-slate-800">Abra o olho — ainda tem estoque, mas já passou do ponto de pedido</h3>
                    <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{olho.length}</span>
                  </div>
                  {olho.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm mb-8">
                      Nenhum item nesta faixa. Com lead time de {leadOff} dias, itens costumam ir direto para "esgotados" ou "no radar" — ajuste o lead time se quiser afinar.
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-3 mb-8">{olho.map((o) => <Card key={o.sku} o={o} />)}</div>
                  )}

                  {/* GRUPO 3: no radar */}
                  {chegando.length > 0 && (<>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={17} className="text-slate-500" />
                      <h3 className="font-bold text-slate-800">No radar — acabam em ≤30 dias, pedido ainda dentro do prazo</h3>
                      <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{chegando.length}</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">{chegando.map((o) => <Card key={o.sku} o={o} />)}</div>
                  </>)}
                </div>
              );
            })()}
          </>
        )}

        {/* ================= TELA: ESTOQUE (independente de vendas) ================= */}
        {tela === "estoque" && <EstoqueScreen />}

        {/* ================= TELA: SUGESTÕES DE APRIMORAMENTO ================= */}
        {tela === "aprimorar" && (
          !R || R.error || !R.sugestoesTitulo ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              Sincronize as vendas (aba Mercado Livre) ou suba a planilha de vendas para gerar as sugestões de título.
            </div>
          ) : R.sugestoesTitulo.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              Nenhum produto precisa de ajuste de título no momento. 👍
            </div>
          ) : (
            <div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 text-sm text-slate-600">
                <b>{R.sugestoesTitulo.length}</b> produtos que valem testar um novo título, priorizados por impacto.
                Foco em: queda após troca de título, perda de desempenho, estoque parado e títulos incompletos.
              </div>
              <div className="space-y-3">
                {R.sugestoesTitulo.slice(0, 100).map((o: any) => (
                  <div key={o.sku} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-[240px]">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-xs text-slate-500">{o.sku}</span>
                          {o.marcaEstoque && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{o.marcaEstoque}</span>}
                          <span className="text-[11px] text-slate-400">{o.un} vendas · {o.runRate.toFixed(2)}/dia</span>
                        </div>
                        <div className="text-sm font-semibold text-slate-800">{o.titulo || "—"}</div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {o.motivosTitulo.map((m: any, i: number) => (
                          <span key={i} className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            m.cor === "vermelho" ? "bg-red-100 text-red-700" :
                            m.cor === "dourado" ? "bg-amber-100 text-amber-800" :
                            m.cor === "azul" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{m.t}</span>
                        ))}
                      </div>
                    </div>
                    {o.dicasTitulo && o.dicasTitulo.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Como melhorar o título</div>
                        <ul className="list-disc pl-5 text-[13px] text-slate-600 space-y-0.5">
                          {o.dicasTitulo.map((d: string, i: number) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    {o.tituloDiag && o.tituloDiag.tituloAntigo && (
                      <div className="mt-2 text-[12px] text-slate-500">
                        Título anterior: <span className="italic">{o.tituloDiag.tituloAntigo}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        )}
        </div>
      </main>
    </div>
  );
}