"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { brl, brlc } from "@/lib/analysis";
import { Warehouse, Search, RefreshCw, Package, DollarSign, Tag, AlertTriangle, Check } from "lucide-react";

// célula editável: clica, edita, salva no blur/enter
function EditCell({ value, tipo, onSave, sufixo }: any) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setVal(value ?? ""); }, [value]);

  async function commit() {
    setEditing(false);
    if (String(val) === String(value ?? "")) return;
    setSaving(true);
    await onSave(tipo === "number" ? Number(val) : val);
    setSaving(false);
  }

  if (editing) {
    return (
      <input autoFocus type={tipo === "number" ? "number" : "text"} value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(value ?? ""); setEditing(false); } }}
        className="w-full border border-sbblue rounded px-2 py-1 text-sm" />
    );
  }
  return (
    <button onClick={() => setEditing(true)}
      className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 text-sm min-h-[30px] flex items-center gap-1">
      {saving ? <RefreshCw size={12} className="animate-spin text-slate-400" /> : null}
      <span className={value == null || value === "" ? "text-slate-300 italic" : ""}>
        {value == null || value === "" ? "—" : `${value}${sufixo || ""}`}
      </span>
    </button>
  );
}

export default function EstoqueScreen() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [busca, setBusca] = useState("");
  const [fMarca, setFMarca] = useState("Todas");

  const carregar = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/estoque");
      const j = await r.json();
      if (!r.ok || j.error) setErr(j.error || "Erro ao carregar estoque.");
      else setProdutos(j.produtos);
    } catch { setErr("Falha de rede ao carregar o estoque."); }
    setBusy(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = useCallback(async (sku: string, campo: string, valor: any) => {
    // otimista: atualiza na tela já
    setProdutos((prev) => prev.map((p) => p.sku === sku ? { ...p, [campo]: valor } : p));
    await fetch("/api/estoque", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, campo, valor }),
    });
  }, []);

  // marcas disponíveis pro filtro
  const marcas = useMemo(() => {
    const s = new Set<string>();
    produtos.forEach((p) => { if (p.marca) s.add(p.marca); });
    return ["Todas", "Sem marca", ...[...s].sort()];
  }, [produtos]);

  const filtrados = useMemo(() => {
    let arr = produtos;
    if (fMarca === "Sem marca") arr = arr.filter((p) => !p.marca);
    else if (fMarca !== "Todas") arr = arr.filter((p) => p.marca === fMarca);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter((p) => (p.sku || "").toLowerCase().includes(q) || (p.nome || "").toLowerCase().includes(q));
    }
    return arr;
  }, [produtos, fMarca, busca]);

  // resumo
  const resumo = useMemo(() => {
    const totalItens = produtos.reduce((a, p) => a + (Number(p.quantidade) || 0), 0);
    const valor = produtos.reduce((a, p) => a + (Number(p.quantidade) || 0) * (Number(p.custo) || 0), 0);
    const semMarca = produtos.filter((p) => !p.marca).length;
    return { totalItens, valor, semMarca, nProdutos: produtos.length };
  }, [produtos]);

  return (
    <div>
      {/* resumo */}
      <div className="grid sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold uppercase tracking-wide"><Package size={14} /> Produtos</div>
          <div className="text-2xl font-bold mt-1" style={{ fontFamily: "Georgia, serif" }}>{resumo.nProdutos.toLocaleString("pt-BR")}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold uppercase tracking-wide"><Warehouse size={14} /> Itens em estoque</div>
          <div className="text-2xl font-bold mt-1" style={{ fontFamily: "Georgia, serif" }}>{resumo.totalItens.toLocaleString("pt-BR")}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold uppercase tracking-wide"><DollarSign size={14} /> Valor em estoque</div>
          <div className="text-2xl font-bold mt-1 text-sbblue" style={{ fontFamily: "Georgia, serif" }}>{brl(resumo.valor)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold uppercase tracking-wide"><Tag size={14} /> Sem marca</div>
          <div className="text-2xl font-bold mt-1 text-amber-600" style={{ fontFamily: "Georgia, serif" }}>{resumo.semMarca.toLocaleString("pt-BR")}</div>
        </div>
      </div>

      {/* controles */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[220px]">
          <Search size={16} className="text-slate-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por SKU ou nome..."
            className="flex-1 outline-none text-sm bg-transparent" />
        </div>
        <select value={fMarca} onChange={(e) => setFMarca(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
          {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={carregar} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 bg-white">
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> Recarregar
        </button>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{err}</div>}

      {/* tabela */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm text-slate-500">
          {busy ? "Carregando..." : `${filtrados.length.toLocaleString("pt-BR")} produtos`}
          <span className="text-slate-400"> · clique numa célula para editar</span>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 sticky top-0"><tr>
              {["SKU", "Produto", "Quantidade", "Marca", "Lead (dias)", "Custo", "Valor"].map((h, i) => (
                <th key={h} className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtrados.slice(0, 500).map((p) => (
                <tr key={p.sku} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-1 font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-1 max-w-[280px] truncate" title={p.nome}>{p.nome || "—"}</td>
                  <td className="px-3 py-1 text-right"><EditCell value={p.quantidade} tipo="number" onSave={(v: any) => salvar(p.sku, "quantidade", v)} /></td>
                  <td className="px-3 py-1"><EditCell value={p.marca} tipo="text" onSave={(v: any) => salvar(p.sku, "marca", v)} /></td>
                  <td className="px-3 py-1 text-right"><EditCell value={p.lead_time} tipo="number" onSave={(v: any) => salvar(p.sku, "lead_time", v)} /></td>
                  <td className="px-3 py-1 text-right"><EditCell value={p.custo} tipo="number" onSave={(v: any) => salvar(p.sku, "custo", v)} /></td>
                  <td className="px-3 py-1 text-right font-semibold whitespace-nowrap">{brlc((Number(p.quantidade) || 0) * (Number(p.custo) || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtrados.length > 500 && (
          <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">Mostrando os primeiros 500. Use a busca para encontrar produtos específicos.</div>
        )}
      </div>
    </div>
  );
}