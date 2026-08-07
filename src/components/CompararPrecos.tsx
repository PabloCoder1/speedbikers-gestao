"use client";
import React, { useState, useCallback } from "react";
import { brl } from "@/lib/analysis";
import { Scale, RefreshCw, AlertTriangle } from "lucide-react";

const CONTA_NOMES: any = { speedbikers: "SpeedBikers", offracer: "OffRacer", sb: "SB", gmr: "GMR" };

export default function CompararPrecos() {
  const [dados, setDados] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [minPct, setMinPct] = useState(5);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setBusy(true); setErro("");
    try {
      const r = await fetch(`/api/comparar-precos?minPct=${minPct}`);
      const j = await r.json();
      if (!r.ok || j.error) setErro(j.error || "Falha ao comparar preços.");
      else setDados(j);
    } catch { setErro("Falha de rede."); }
    setBusy(false);
  }, [minPct]);

  return (
    <div>
      <div className="bg-white rounded-xl p-4 mb-5 flex items-center justify-between gap-3 flex-wrap" style={{ border: "1px solid var(--line)" }}>
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Compara o mesmo produto (SKU) entre suas contas e mostra onde há diferença de preço relevante — para você não competir consigo mesmo.
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-semibold" style={{ color: "var(--muted)" }}>Diferença mínima</label>
          <select value={minPct} onChange={(e) => setMinPct(Number(e.target.value))}
            className="border rounded-lg px-2 py-1.5 text-sm" style={{ borderColor: "var(--line)" }}>
            {[3, 5, 10, 15, 20].map((v) => <option key={v} value={v}>{v}%</option>)}
          </select>
          <button onClick={carregar} disabled={busy}
            className="flex items-center gap-2 text-white font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-60" style={{ background: "var(--blue)" }}>
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> Comparar
          </button>
        </div>
      </div>

      {erro && <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{ background: "#fff0ef", border: "1px solid #f5c9c7", color: "#c72f2f" }}>{erro}</div>}

      {!dados && !busy && (
        <div className="bg-white rounded-2xl p-8 text-center" style={{ border: "1px solid var(--line)", color: "var(--muted)" }}>
          <Scale size={36} className="mx-auto mb-3" style={{ color: "#c3ccda" }} />
          Clique em "Comparar" para cruzar os preços entre suas contas conectadas.
        </div>
      )}

      {busy && (
        <div className="bg-white rounded-2xl p-8 text-center" style={{ border: "1px solid var(--line)", color: "var(--muted)" }}>
          <RefreshCw size={28} className="mx-auto mb-3 animate-spin" style={{ color: "var(--blue)" }} />
          Buscando anúncios de cada conta e cruzando os preços... (pode levar alguns segundos)
        </div>
      )}

      {dados && !busy && (
        <div>
          <div className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            {dados.contasConectadas?.length || 0} contas conectadas · <b>{dados.total}</b> produtos com diferença ≥ {minPct}%
          </div>

          {dados.total === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center" style={{ border: "1px solid var(--line)", color: "var(--muted)" }}>
              Nenhum produto com diferença de preço relevante entre as contas. 👍
            </div>
          ) : (
            <div className="space-y-3">
              {dados.comparacoes.map((c: any) => (
                <div key={c.sku} className="bg-white rounded-xl p-4" style={{ border: "1px solid var(--line)" }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>{c.sku}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: "#fff3e0", color: "#b45309" }}>
                          <AlertTriangle size={11} /> {c.diffPct}% de diferença
                        </span>
                      </div>
                      <div className="text-sm font-semibold">{c.titulo || "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px]" style={{ color: "var(--muted)" }}>menor → maior</div>
                      <div className="font-display font-bold" style={{ color: "var(--ink)" }}>{brl(c.min)} → {brl(c.max)}</div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {c.precos.map((p: any, i: number) => (
                      <div key={p.conta} className="rounded-lg p-2.5" style={{ background: i === 0 ? "#eafaf1" : "#f7f8fa", border: i === 0 ? "1px solid #b6e6cb" : "1px solid transparent" }}>
                        <div className="text-[11px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "#7d8ba1" }}>{CONTA_NOMES[p.conta] || p.conta}</div>
                        <div className="text-[15px] font-bold" style={{ color: i === 0 ? "var(--green)" : "var(--ink)" }}>{brl(p.preco)}</div>
                        {i === 0 && <div className="text-[10px] font-semibold" style={{ color: "var(--green)" }}>mais barato</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
