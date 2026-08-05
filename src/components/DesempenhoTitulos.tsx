"use client";
import React, { useState, useCallback } from "react";
import { brl } from "@/lib/analysis";
import { TrendingUp, TrendingDown, Sparkles, RefreshCw, ArrowRight, Tag, DollarSign } from "lucide-react";

// veredito visual: foi título ou preço?
function CausaBadge({ causa, precoMudou }: { causa: string; precoMudou: boolean }) {
  if (causa === "preco") {
    return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: "#fff3e0", color: "#b45309" }}><DollarSign size={11} /> Provável causa: preço</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: "#e8effd", color: "#1e47ba" }}><Tag size={11} /> Provável causa: título</span>;
}

export default function DesempenhoTitulos({ itens }: { itens: any[] }) {
  const [filtro, setFiltro] = useState<"todos" | "sucesso" | "queda">("todos");
  const [iaResult, setIaResult] = useState<Record<string, any>>({});

  const investigarIA = useCallback(async (o: any) => {
    setIaResult((p) => ({ ...p, [o.sku]: { estado: "carregando" } }));
    try {
      const prompt = {
        produto: {
          sku: o.sku, titulo: o.titulo, preco: o.precoD, marca: o.marcaEstoque,
          un: o.un, runRate: o.rrD,
          emQueda: o.tipo === "queda", emCrescimento: o.tipo === "sucesso",
        },
        // contexto extra pra IA analisar a causa
        concorrentes: [],
        mediaVendas: 0,
        contexto: `Este produto teve o título alterado. Antes: velocidade ${o.rrA?.toFixed(2)}/dia a ${brl(o.precoA || 0)}. Depois: ${o.rrD?.toFixed(2)}/dia a ${brl(o.precoD || 0)}. O preço ${o.precoMudou ? `mudou ${o.precoPct?.toFixed(0)}%` : "ficou estável"}. Analise se a mudança de desempenho (${o.quedaPct?.toFixed(0)}%) foi causada pela troca de título ou pela mudança de preço.`,
      };
      const r = await fetch("/api/analisar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt),
      });
      const j = await r.json();
      if (r.ok && j.analise) setIaResult((p) => ({ ...p, [o.sku]: { estado: "ok", analise: j.analise, fonte: j.fonte } }));
      else setIaResult((p) => ({ ...p, [o.sku]: { estado: "erro", msg: j.error || "falha" } }));
    } catch {
      setIaResult((p) => ({ ...p, [o.sku]: { estado: "erro", msg: "rede" } }));
    }
  }, []);

  const filtrados = itens.filter((o) => filtro === "todos" || o.tipo === filtro);
  const nSucesso = itens.filter((o) => o.tipo === "sucesso").length;
  const nQueda = itens.filter((o) => o.tipo === "queda").length;

  if (!itens || itens.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center" style={{ border: "1px solid var(--line)", color: "var(--muted)" }}>
        Nenhuma troca de título com impacto relevante detectada no período. As trocas aparecem aqui quando há vendas suficientes antes e depois da mudança.
      </div>
    );
  }

  return (
    <div>
      {/* filtros */}
      <div className="flex gap-2 mb-5">
        {([["todos", `Todos (${itens.length})`], ["sucesso", `Deram certo (${nSucesso})`], ["queda", `Em queda (${nQueda})`]] as any[]).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className="px-4 py-2 rounded-lg text-[13px] font-bold transition"
            style={filtro === k ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", color: "#65748b", border: "1px solid var(--line)" }}>
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtrados.map((o) => {
          const positivo = o.tipo === "sucesso";
          const ia = iaResult[o.sku];
          return (
            <div key={o.sku} className="bg-white rounded-xl p-4" style={{ border: "1px solid var(--line)", borderLeft: `4px solid ${positivo ? "var(--green)" : "var(--red)"}` }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>{o.sku}</span>
                    {o.marcaEstoque && <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: "#f0f3f7", color: "#526279" }}>{o.marcaEstoque}</span>}
                    <span className="text-[11px]" style={{ color: "var(--muted)" }}>{o.un} vendas no período</span>
                  </div>
                  <div className="text-sm font-semibold">{o.titulo || "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: positivo ? "var(--green)" : "var(--red)" }}>
                    {positivo ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {o.quedaPct > 0 ? "+" : ""}{o.quedaPct.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* antes / depois */}
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                <div className="rounded-lg p-2.5" style={{ background: "#f7f8fa" }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#8492a8" }}>Antes da troca</div>
                  <div className="text-[13px]">{o.rrA?.toFixed(2)}/dia · {brl(o.precoA || 0)}</div>
                </div>
                <div className="rounded-lg p-2.5" style={{ background: "#f7f8fa" }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#8492a8" }}>Depois da troca</div>
                  <div className="text-[13px]">{o.rrD?.toFixed(2)}/dia · {brl(o.precoD || 0)}</div>
                </div>
              </div>

              {/* veredito por regras */}
              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <CausaBadge causa={o.causa} precoMudou={o.precoMudou} />
                  {o.precoMudou && (
                    <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                      Preço {o.precoPct > 0 ? "subiu" : "caiu"} {Math.abs(o.precoPct).toFixed(0)}% junto
                    </span>
                  )}
                </div>
                {!ia && (
                  <button onClick={() => investigarIA(o)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: "#eef2fd", color: "var(--blue)" }}>
                    <Sparkles size={13} /> Investigar com IA
                  </button>
                )}
              </div>

              {/* resultado IA */}
              {ia && (
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                  {ia.estado === "carregando" ? (
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}><RefreshCw size={14} className="animate-spin" /> Investigando causa com IA...</div>
                  ) : ia.estado === "erro" ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: "var(--red)" }}>Não foi possível investigar ({ia.msg}).</span>
                      <button onClick={() => investigarIA(o)} className="text-xs font-bold" style={{ color: "var(--blue)" }}>Tentar de novo</button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={14} style={{ color: "var(--blue)" }} />
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Análise IA · via {ia.fonte}</span>
                      </div>
                      {ia.analise.resumo && <p className="text-[13px] mb-2">{ia.analise.resumo}</p>}
                      {ia.analise.titulo?.sugestao && (
                        <div className="text-[13px] rounded-lg p-2.5 mb-1.5" style={{ background: "#f7f8fa" }}>
                          <b>Título sugerido:</b> "{ia.analise.titulo.sugestao}"
                        </div>
                      )}
                      {ia.analise.preco?.comentario && (
                        <div className="text-[13px] rounded-lg p-2.5" style={{ background: "#f7f8fa" }}>
                          <b>Preço:</b> {ia.analise.preco.comentario} {ia.analise.preco.acao ? `— ${ia.analise.preco.acao}` : ""}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}