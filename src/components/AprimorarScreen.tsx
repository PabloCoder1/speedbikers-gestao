"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { brl } from "@/lib/analysis";
import { Sparkles, RefreshCw, ChevronLeft, ChevronRight, TrendingUp, Store, ExternalLink } from "lucide-react";

const PAGE = 20;

// badge colorido para veredito
function Veredito({ v }: { v: string }) {
  const map: any = {
    bom: "bg-green-100 text-green-700", competitivo: "bg-green-100 text-green-700",
    ajustar: "bg-amber-100 text-amber-800", alto: "bg-red-100 text-red-700",
    ruim: "bg-red-100 text-red-700", baixo: "bg-blue-100 text-blue-700",
  };
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${map[v] || "bg-slate-100 text-slate-500"}`}>{v}</span>;
}

export default function AprimorarScreen({ sugestoes }: { sugestoes: any[] }) {
  const [pagina, setPagina] = useState(0);
  const [analises, setAnalises] = useState<Record<string, any>>({}); // sku -> {estado, dados}

  const totalPaginas = Math.max(1, Math.ceil(sugestoes.length / PAGE));
  const daPagina = useMemo(
    () => sugestoes.slice(pagina * PAGE, pagina * PAGE + PAGE),
    [sugestoes, pagina]
  );

  // analisa um produto: busca concorrentes + IA
  const analisarProduto = useCallback(async (o: any) => {
    setAnalises((prev) => ({ ...prev, [o.sku]: { estado: "carregando" } }));
    try {
      // 1) concorrentes no ML
      let concorrentes: any[] = [], mediaVendas = 0;
      try {
        const rc = await fetch(`/api/concorrentes?titulo=${encodeURIComponent(o.titulo || "")}&preco=${o.preco || 0}`);
        const jc = await rc.json();
        if (rc.ok) { concorrentes = jc.concorrentes || []; mediaVendas = jc.mediaVendas || 0; }
      } catch {}
      // 2) análise IA
      const ra = await fetch("/api/analisar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produto: { sku: o.sku, titulo: o.titulo, preco: o.preco, marca: o.marcaEstoque, un: o.un, runRate: o.runRate, bal: o.bal, emQueda: o.emQueda, emCrescimento: o.emCrescimento },
          concorrentes, mediaVendas,
        }),
      });
      const ja = await ra.json();
      if (ra.ok && ja.analise) {
        setAnalises((prev) => ({ ...prev, [o.sku]: { estado: "ok", analise: ja.analise, fonte: ja.fonte, concorrentes, mediaVendas } }));
      } else {
        setAnalises((prev) => ({ ...prev, [o.sku]: { estado: "erro", msg: ja.error || "falha" } }));
      }
    } catch {
      setAnalises((prev) => ({ ...prev, [o.sku]: { estado: "erro", msg: "rede" } }));
    }
  }, []);

  // ao abrir/trocar de página: analisa automaticamente os que ainda não têm análise
  useEffect(() => {
    daPagina.forEach((o) => {
      if (!analises[o.sku]) analisarProduto(o);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, sugestoes]);

  if (!sugestoes || sugestoes.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
        Nenhum produto precisa de ajuste no momento. 👍
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-600">
          <b>{sugestoes.length}</b> produtos priorizados · a IA analisa <b>{PAGE} por página</b> (título, preço vs concorrentes, foto e descrição).
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0}
            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-slate-600">Página {pagina + 1} de {totalPaginas}</span>
          <button onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}
            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="space-y-3">
        {daPagina.map((o: any) => {
          const a = analises[o.sku];
          return (
            <div key={o.sku} className="bg-white border border-slate-200 rounded-xl p-4">
              {/* cabeçalho do produto */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-slate-500">{o.sku}</span>
                    {o.marcaEstoque && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{o.marcaEstoque}</span>}
                    <span className="text-[11px] text-slate-400">{o.un} vendas · {o.runRate.toFixed(2)}/dia</span>
                    {o.preco ? <span className="text-[11px] text-slate-400">· {brl(o.preco)}</span> : null}
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

              {/* análise IA */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                {!a || a.estado === "carregando" ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <RefreshCw size={14} className="animate-spin" /> Analisando com IA (título, preço, concorrentes)...
                  </div>
                ) : a.estado === "erro" ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-red-500">Não foi possível analisar ({a.msg}).</span>
                    <button onClick={() => analisarProduto(o)} className="text-xs font-bold text-sbblue flex items-center gap-1"><RefreshCw size={12} /> Tentar de novo</button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={15} className="text-sbblue" />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Análise IA</span>
                      <span className="text-[10px] text-slate-300">via {a.fonte}</span>
                      {a.analise.prioridade && <Veredito v={a.analise.prioridade} />}
                    </div>
                    {a.analise.resumo && <p className="text-[13px] text-slate-700 mb-2">{a.analise.resumo}</p>}

                    <div className="grid md:grid-cols-2 gap-2 text-[13px]">
                      {a.analise.titulo && (
                        <div className="bg-slate-50 rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 mb-1"><span className="font-bold text-slate-600">Título</span><Veredito v={a.analise.titulo.veredito} /></div>
                          {a.analise.titulo.sugestao && <div className="text-slate-800 font-medium">"{a.analise.titulo.sugestao}"</div>}
                          {a.analise.titulo.porque && <div className="text-slate-500 text-[12px] mt-0.5">{a.analise.titulo.porque}</div>}
                        </div>
                      )}
                      {a.analise.preco && (
                        <div className="bg-slate-50 rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 mb-1"><span className="font-bold text-slate-600">Preço</span><Veredito v={a.analise.preco.veredito} /></div>
                          {a.analise.preco.comentario && <div className="text-slate-700">{a.analise.preco.comentario}</div>}
                          {a.analise.preco.acao && <div className="text-slate-500 text-[12px] mt-0.5">{a.analise.preco.acao}</div>}
                        </div>
                      )}
                      {a.analise.foto?.sugestao && (
                        <div className="bg-slate-50 rounded-lg p-2.5"><span className="font-bold text-slate-600">Foto: </span><span className="text-slate-700">{a.analise.foto.sugestao}</span></div>
                      )}
                      {a.analise.descricao?.sugestao && (
                        <div className="bg-slate-50 rounded-lg p-2.5"><span className="font-bold text-slate-600">Descrição: </span><span className="text-slate-700">{a.analise.descricao.sugestao}</span></div>
                      )}
                    </div>

                    {/* concorrentes */}
                    {a.concorrentes && a.concorrentes.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                          <Store size={13} /> {a.concorrentes.length} concorrentes mais baratos · média de vendas: {a.mediaVendas}
                        </div>
                        <div className="border border-slate-100 rounded-lg overflow-hidden">
                          <table className="w-full text-[12px]">
                            <thead className="bg-slate-50"><tr>
                              <th className="text-left px-2 py-1.5 text-slate-400 font-semibold">Loja</th>
                              <th className="text-right px-2 py-1.5 text-slate-400 font-semibold">Preço</th>
                              <th className="text-right px-2 py-1.5 text-slate-400 font-semibold">Vendidos</th>
                              <th className="px-2 py-1.5"></th>
                            </tr></thead>
                            <tbody>
                              {a.concorrentes.map((c: any, i: number) => (
                                <tr key={i} className="border-t border-slate-100">
                                  <td className="px-2 py-1.5 text-slate-700">{c.loja || "—"}</td>
                                  <td className="px-2 py-1.5 text-right font-semibold text-green-700">{brl(c.preco)}</td>
                                  <td className="px-2 py-1.5 text-right text-slate-500">{c.vendidos ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-right">
                                    {c.permalink && <a href={c.permalink} target="_blank" rel="noopener noreferrer" className="text-sbblue inline-flex"><ExternalLink size={13} /></a>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* paginação inferior */}
      <div className="flex items-center justify-center gap-2 mt-5">
        <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold disabled:opacity-40 flex items-center gap-1"><ChevronLeft size={15} /> Anterior</button>
        <span className="text-sm text-slate-500">Página {pagina + 1} de {totalPaginas}</span>
        <button onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold disabled:opacity-40 flex items-center gap-1">Próxima <ChevronRight size={15} /></button>
      </div>
    </div>
  );
}
