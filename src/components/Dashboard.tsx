"use client";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { analyze, readSheetSmart, mlRowsToVendas, brl, brlc, dstr } from "@/lib/analysis";
import EstoqueScreen from "@/components/EstoqueScreen";
import AprimorarScreen from "@/components/AprimorarScreen";
import DesempenhoTitulos from "@/components/DesempenhoTitulos";
import CompararPrecos from "@/components/CompararPrecos";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Upload, TrendingDown, TrendingUp, Package, AlertTriangle, DollarSign, Boxes,
  RefreshCw, ShoppingCart, Clock, Tag, ChevronDown, ChevronRight, Layers, Eye,
  Lock, Unlock, LogOut, Cloud, FileSpreadsheet, ShieldAlert, Warehouse, Menu, Sparkles, Scale,
} from "lucide-react";

// ---------------- UI atoms ----------------
const CLS_COLOR = { A: "#1A3FB0", B: "#FFC107", C: "#B8B2A6" };
const CONTAS_ML = [
  { id: "speedbikers", nome: "SpeedBikers" },
  { id: "offracer", nome: "OffRacer" },
  { id: "sb", nome: "SB" },
  { id: "gmr", nome: "GMR" },
];
const CONTA_NOMES: any = { speedbikers: "SpeedBikers", offracer: "OffRacer", sb: "SB", gmr: "GMR", todas: "Todas" };
const MOTIVO_COLOR = { vermelho: "bg-red-100 text-red-700", azul: "bg-blue-100 text-blue-700", dourado: "bg-amber-100 text-amber-800", cinza: "bg-slate-100 text-slate-500" };

function KpiCard({ icon: Icon, label, value, sub, tone = "slate" }: any) {
  const toneColor: any = {
    slate: "var(--ink)", blue: "var(--blue)", red: "var(--red)", amber: "var(--orange)", green: "var(--green)",
  };
  return (
    <div className="flex-1 min-w-[170px] bg-white rounded-xl p-[18px]" style={{ border: "1px solid var(--line)" }}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.06em] uppercase" style={{ color: "#7988a0" }}>
        <Icon size={13} /> {label}
      </div>
      <div className="font-display text-[27px] font-bold mt-2 leading-none" style={{ color: toneColor[tone] }}>{value}</div>
      {sub && <div className="text-[11px] mt-1.5" style={{ color: "#8391a8" }}>{sub}</div>}
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
  const [contaAtiva, setContaAtiva] = useState('speedbikers'); // conta ML ativa ('todas' soma tudo)
  const [contasConectadas, setContasConectadas] = useState<string[]>([]); // contas com token salvo
  const [locked, setLocked] = useState(initialLocked);
  const [lockBusy, setLockBusy] = useState(false);
  const [mlBusy, setMlBusy] = useState(false);
  const [mlMsg, setMlMsg] = useState('');

  // busca quais contas estão conectadas (pra mostrar o sinalizador na sidebar)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/contas-status");
        const j = await r.json();
        if (r.ok && j.conectadas) setContasConectadas(j.conectadas);
      } catch {}
    })();
  }, [mlMsg]); // reavalia após conectar/sincronizar
  const [autoSync, setAutoSync] = useState(true); // sincronização automática a cada 5min
  const [ultimoSync, setUltimoSync] = useState<Date | null>(null);

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
  const syncML = useCallback(async (dias, conta = contaAtiva) => {
    setMlBusy(true); setMlMsg("");
    try {
      // quais contas buscar: uma específica, ou todas as 4 se "todas"
      const contas = conta === "todas" ? ["speedbikers", "offracer", "sb", "gmr"] : [conta];
      let todasRows: any[] = [];
      let erros: string[] = [];
      let semConexao = 0;

      for (const c of contas) {
        try {
          const r = await fetch(`/api/ml/sync?dias=${dias}&conta=${c}`);
          const j = await r.json();
          if (!r.ok || j.error) {
            if (j.error === "sem_conexao_ml") semConexao++;
            else erros.push(`${c}: ${j.error || r.status}`);
          } else {
            // marca cada linha com a conta de origem
            (j.rows || []).forEach((row: any) => { row.conta = c; });
            todasRows = todasRows.concat(j.rows || []);
          }
        } catch { erros.push(`${c}: rede`); }
      }

      if (todasRows.length === 0) {
        if (semConexao === contas.length) {
          setMlMsg(conta === "todas"
            ? "Nenhuma conta conectada ainda. Conecte as contas abaixo."
            : "Conecte esta conta do Mercado Livre primeiro (botão abaixo).");
        } else {
          setMlMsg("Erro ao sincronizar" + (erros.length ? ": " + erros.join(" · ") : "."));
        }
        setMlBusy(false); setUltimoSync(new Date());
        return;
      }

      const rows = mlRowsToVendas(todasRows);
      setVendasRaw(rows);
      const label = dias === 0 ? "período total disponível" : `últimos ${dias} dias`;
      const nomeConta = conta === "todas" ? "todas as contas" : (CONTA_NOMES[conta] || conta);
      setVName(`Mercado Livre (${nomeConta}) — ${todasRows.length} vendas (${label})`);
      setMlMsg(`Sincronizado (${nomeConta}): ${todasRows.length} itens de venda dos ${label}.`);

      // ---- vendas de HOJE, agrupadas por produto (acumulado) ----
      const hojeBR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const mapa = new Map();
      for (const v of todasRows) {
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
      setVendasHoje([...mapa.values()].sort((a, b) => b.unidades - a.unidades));

      // ---- baixa automática de estoque (por conta, evita descontar 2x) ----
      try {
        // agrupa pedidos por conta pra registrar a origem certa
        const porConta: Record<string, any[]> = {};
        for (const v of todasRows) {
          if (!v.order_id || !v.sku) continue;
          const c = v.conta || conta;
          (porConta[c] = porConta[c] || []).push({ order_id: v.order_id, sku: v.sku, quantidade: v.unidades, data: v.data });
        }
        let totalDesc = 0, totalPed = 0;
        for (const [c, pedidos] of Object.entries(porConta)) {
          if (!pedidos.length) continue;
          const rb = await fetch("/api/baixa", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pedidos, conta: c }),
          });
          const jb = await rb.json();
          if (rb.ok) { totalDesc += jb.itensDescontados || 0; totalPed += jb.pedidosDescontados || 0; }
        }
        if (totalPed > 0) {
          setMlMsg(`Sincronizado (${nomeConta}): ${todasRows.length} itens. Baixa automática: ${totalDesc} itens de ${totalPed} pedidos novos.`);
          try {
            const re = await fetch("/api/estoque");
            const je = await re.json();
            if (re.ok && je.produtos) setProdutosSupabase(je.produtos);
          } catch {}
        }
      } catch { /* baixa é best-effort */ }
    } catch (e) { setMlMsg("Falha de rede ao sincronizar."); }
    setMlBusy(false);
    setUltimoSync(new Date());
  }, [contaAtiva]);

  // ---- sincronização automática a cada 5 minutos (últimos 7 dias, conta ativa) ----
  useEffect(() => {
    if (!autoSync || fonte !== "ml") return;
    const id = setInterval(() => {
      if (!mlBusy) syncML(7, contaAtiva); // só a conta que está sendo vista agora
    }, 5 * 60 * 1000); // 5 minutos
    return () => clearInterval(id);
  }, [autoSync, fonte, mlBusy, syncML, contaAtiva]);

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

  const avatarIniciais = (email || "U").slice(0, 2).toUpperCase();
  const hojeFmt = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric" }).toUpperCase().replace(".", "");

  return (
    <div className="min-h-screen flex" style={{ background: "var(--ground)", color: "var(--ink)" }}>
      {/* ===== MENU LATERAL FIXO ===== */}
      <aside className="w-[260px] shrink-0 bg-white flex flex-col fixed h-screen" style={{ borderRight: "1px solid var(--line)" }}>
        {/* marca */}
        <div className="flex items-center gap-2.5 px-6 pt-6 pb-6 mx-1" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="grid place-items-center w-8 h-8 rounded-[10px] text-white font-display text-lg" style={{ background: "var(--blue)" }}>S</div>
          <div className="lowercase">
            <div className="font-display font-bold text-[17px] leading-none tracking-tight">speed bikers</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>gestão de compras</div>
          </div>
        </div>

        {/* conta */}
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="w-8 h-8 rounded-full grid place-items-center text-[10px] font-bold" style={{ background: "#e8efff", color: "var(--blue)" }}>{avatarIniciais}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate">{email}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>{role === "admin" ? "Administrador" : "Usuário"} · Mercado Livre</div>
          </div>
        </div>

        {/* navegação */}
        <nav className="px-3 flex-1 overflow-y-auto">
          <div className="text-[10px] font-bold tracking-[0.09em] px-3 mt-3 mb-1.5" style={{ color: "#9aa7bb" }}>OPERAÇÃO</div>
          {[
            ["dashboard", "Visão geral", Layers],
            ["comprar", "Comprar agora", ShoppingCart],
            ["desempenho", "Desempenho de títulos", TrendingUp],
            ["comparar", "Comparar preços", Scale],
            ["aprimorar", "Otimizar anúncios", Sparkles],
            ["estoque", "Estoque", Warehouse],
          ].map(([k, l, Ic]: any) => {
            const ativo = tela === k;
            return (
              <button key={k} onClick={() => setTela(k)}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-semibold my-0.5 text-left transition"
                style={ativo
                  ? { background: "var(--blue)", color: "#fff", boxShadow: "0 7px 15px #1e47ba25" }
                  : { color: "#45526a" }}>
                <Ic size={18} style={{ color: ativo ? "#fff" : "#71809a" }} /> {l}
                {k === "comprar" && R && !R.error && R.kpis.nRecomendados > 0 && (
                  <span className="ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5"
                    style={ativo ? { background: "#fff", color: "var(--blue)" } : { background: "#fde3e3", color: "#d72222" }}>{R.kpis.nRecomendados}</span>
                )}
              </button>
            );
          })}

          <div className="text-[10px] font-bold tracking-[0.09em] px-3 mt-6 mb-1.5" style={{ color: "#9aa7bb" }}>CANAIS</div>
          <button onClick={() => setFonte("upload")}
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-semibold my-0.5 text-left transition"
            style={fonte === "upload" ? { background: "#eef1f6", color: "var(--ink)" } : { color: "#45526a" }}>
            <FileSpreadsheet size={18} style={{ color: "#71809a" }} /> Upload de Excel
          </button>
          <button onClick={() => setFonte("ml")}
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-semibold my-0.5 text-left transition"
            style={fonte === "ml" ? { background: "#eef1f6", color: "var(--ink)" } : { color: "#45526a" }}>
            <Cloud size={18} style={{ color: "#71809a" }} /> Mercado Livre
            <span className="ml-auto w-[7px] h-[7px] rounded-full" style={{ background: "#18a56d" }} />
          </button>

          {/* seletor de conta ML (aparece quando a fonte é Mercado Livre) */}
          {fonte === "ml" && (
            <div className="mt-2 mb-1 pl-2">
              <div className="text-[9px] font-bold tracking-[0.08em] px-1 mb-1" style={{ color: "#aab4c6" }}>CONTA ATIVA</div>
              <button onClick={() => { setContaAtiva("todas"); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-semibold my-0.5 text-left transition"
                style={contaAtiva === "todas" ? { background: "var(--blue)", color: "#fff" } : { color: "#56637a" }}>
                <Layers size={15} style={{ color: contaAtiva === "todas" ? "#fff" : "#8592a8" }} /> Todas as contas
              </button>
              {CONTAS_ML.map((c) => {
                const conectada = contasConectadas.includes(c.id);
                return (
                  <button key={c.id} onClick={() => { setContaAtiva(c.id); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-semibold my-0.5 text-left transition"
                    style={contaAtiva === c.id ? { background: "var(--blue)", color: "#fff" } : { color: "#56637a" }}>
                    <span className="w-[6px] h-[6px] rounded-full ml-1"
                      style={{ background: conectada ? "#18a56d" : (contaAtiva === c.id ? "#ffffff88" : "#d0d7e2") }} /> {c.nome}
                    {!conectada && <span className="ml-auto text-[9px] font-bold" style={{ color: contaAtiva === c.id ? "#ffffffcc" : "#aab4c6" }}>conectar</span>}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* rodapé */}
        <div className="px-4 py-4 mx-1" style={{ borderTop: "1px solid var(--line)" }}>
          {fonte === "ml" && (
            <button onClick={() => setAutoSync((v) => !v)}
              className="w-full flex items-center gap-2 px-1 pb-3 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: autoSync ? "#14a66a" : "#b9c3d3" }} />
              {autoSync
                ? (ultimoSync
                    ? `Sincronizado ${ultimoSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`
                    : "Auto-sync ativo (5 min)")
                : "Auto-sync pausado"}
            </button>
          )}
          {role === "admin" && (
            <button onClick={toggleLock} disabled={lockBusy}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold mb-1.5 border transition"
              style={locked ? { background: "var(--red)", color: "#fff", borderColor: "var(--red)" } : { background: "#fff", color: "var(--red)", borderColor: "#f0c9c9" }}>
              {locked ? <><Unlock size={15} /> Desbloquear app</> : <><Lock size={15} /> Bloquear app</>}
            </button>
          )}
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold transition hover:bg-slate-50"
            style={{ color: "var(--muted)" }}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      </aside>

      {/* ===== CONTEÚDO ===== */}
      <main className="flex-1 ml-[260px] min-h-screen">
        <div className="max-w-[1280px] mx-auto px-12 py-10 pb-20">
          {/* cabeçalho da tela */}
          <div className="mb-7">
            <p className="text-[10px] font-bold tracking-[0.1em] mb-1.5" style={{ color: "#8090aa" }}>
              OPERAÇÃO · {hojeFmt}
            </p>
            <h1 className="font-display text-[34px] font-bold leading-none mb-1.5">
              {tela === "dashboard" ? "Visão geral" : tela === "comprar" ? "Comprar agora" : tela === "desempenho" ? "Desempenho de títulos" : tela === "comparar" ? "Comparar preços" : tela === "aprimorar" ? "Otimizar anúncios" : "Estoque"}
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {tela === "dashboard" ? "O que precisa da sua atenção hoje." :
               tela === "comprar" ? "Reposição calculada pela sua demanda e prazo de entrega." :
               tela === "desempenho" ? "Trocas de título que deram certo ou derrubaram as vendas — foi o título ou o preço?" :
               tela === "comparar" ? "O mesmo produto entre suas contas — evite competir consigo mesmo." :
               tela === "aprimorar" ? "Oportunidades para melhorar a performance dos anúncios." :
               "Controle seus produtos, marcas e prazos de reposição."}
            </p>
          </div>

          {role === "admin" && locked && (
            <div className="rounded-xl px-4 py-3 text-sm mb-5 flex items-center gap-2" style={{ background: "#fff0ef", border: "1px solid #f5c9c7", color: "#c72f2f" }}>
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
                <RefreshCw size={16} className={mlBusy ? "animate-spin" : ""} /> Sincronizar {contaAtiva === "todas" ? "todas as contas" : CONTA_NOMES[contaAtiva]}
              </button>
            </div>

            {/* conectar cada conta */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-500 mb-2">Conectar contas do Mercado Livre</div>
              <div className="flex gap-2 flex-wrap">
                {CONTAS_ML.map((c) => (
                  <a key={c.id} href={`/api/ml/authorize?conta=${c.id}`}
                    className="flex items-center gap-2 bg-white text-sbblue font-semibold rounded-lg px-3 py-2 border border-sbblue text-[13px]">
                    <Cloud size={14} /> {c.nome}
                  </a>
                ))}
              </div>
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

        {/* ================= TELA: COMPARAR PREÇOS ENTRE CONTAS ================= */}
        {tela === "comparar" && <CompararPrecos />}

        {/* ================= TELA: ESTOQUE (independente de vendas) ================= */}
        {tela === "estoque" && <EstoqueScreen />}

        {/* ================= TELA: DESEMPENHO DE TÍTULOS ================= */}
        {tela === "desempenho" && (
          !R || R.error || !R.desempenhoTitulos ? (
            <div className="bg-white rounded-2xl p-8 text-center" style={{ border: "1px solid var(--line)", color: "var(--muted)" }}>
              Sincronize as vendas (aba Mercado Livre) ou suba a planilha de vendas para ver o desempenho das trocas de título.
            </div>
          ) : (
            <DesempenhoTitulos itens={R.desempenhoTitulos} />
          )
        )}

        {/* ================= TELA: SUGESTÕES DE APRIMORAMENTO ================= */}
        {tela === "aprimorar" && (
          !R || R.error || !R.sugestoesTitulo ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              Sincronize as vendas (aba Mercado Livre) ou suba a planilha de vendas para gerar as sugestões.
            </div>
          ) : (
            <AprimorarScreen sugestoes={R.sugestoesTitulo} />
          )
        )}
        </div>
      </main>
    </div>
  );
}