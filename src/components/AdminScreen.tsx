"use client";
import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, UserCheck, UserX, Trash2, LogOut, Pencil, UserPlus, Shield, Check, X } from "lucide-react";

function tempoAtivo(min: number | null) {
  if (min == null) return { txt: "nunca acessou", cor: "#aab4c6" };
  if (min < 3) return { txt: "ativo agora", cor: "#18a56d" };
  if (min < 60) return { txt: `ativo há ${min} min`, cor: "#5a9" };
  if (min < 1440) return { txt: `ativo há ${Math.round(min / 60)}h`, cor: "#8492a8" };
  return { txt: `ativo há ${Math.round(min / 1440)}d`, cor: "#aab4c6" };
}

export default function AdminScreen() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState("");
  const [editando, setEditando] = useState<any>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<any>({ email: "", senha: "", nome: "", role: "viewer" });

  const carregar = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/usuarios");
      const j = await r.json();
      if (r.ok && j.usuarios) setUsuarios(j.usuarios);
      else setMsg(j.error || "Erro ao carregar.");
    } catch { setMsg("Falha de rede."); }
    setBusy(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const acao = useCallback(async (acao: string, payload: any = {}) => {
    setMsg("");
    try {
      const r = await fetch("/api/admin/acao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, ...payload }),
      });
      const j = await r.json();
      setMsg(j.ok ? j.msg : (j.error || "falha"));
      if (j.ok) { setEditando(null); setCriando(false); carregar(); }
    } catch { setMsg("Falha de rede."); }
  }, [carregar]);

  const pendentes = usuarios.filter((u) => u.status === "pendente");
  const aprovados = usuarios.filter((u) => u.status !== "pendente");

  return (
    <div>
      {msg && <div className="rounded-xl px-4 py-2.5 text-sm mb-4" style={{ background: "#eef4ff", border: "1px solid #cfe0ff", color: "#1e47ba" }}>{msg}</div>}

      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          <b>{usuarios.length}</b> usuários · <b>{pendentes.length}</b> aguardando aprovação
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setCriando(true); setForm({ email: "", senha: "", nome: "", role: "viewer" }); }}
            className="flex items-center gap-2 text-white font-bold rounded-lg px-3 py-2 text-sm" style={{ background: "var(--blue)" }}>
            <UserPlus size={15} /> Criar usuário
          </button>
          <button onClick={carregar} className="flex items-center gap-2 font-semibold rounded-lg px-3 py-2 text-sm" style={{ background: "#fff", border: "1px solid var(--line)", color: "#65748b" }}>
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </div>

      {/* criar usuário */}
      {criando && (
        <div className="bg-white rounded-xl p-4 mb-5" style={{ border: "1px solid var(--blue)" }}>
          <div className="font-bold mb-3 flex items-center gap-2"><UserPlus size={16} style={{ color: "var(--blue)" }} /> Novo usuário (já aprovado)</div>
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
            <input placeholder="Senha" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
            <input placeholder="Nome (opcional)" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
              <option value="viewer">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => acao("criar", form)} className="text-white font-bold rounded-lg px-4 py-2 text-sm" style={{ background: "var(--green)" }}>Criar</button>
            <button onClick={() => setCriando(false)} className="font-semibold rounded-lg px-4 py-2 text-sm" style={{ background: "#f0f3f7", color: "#65748b" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* pendentes */}
      {pendentes.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--orange)" }}>Aguardando aprovação ({pendentes.length})</div>
          <div className="space-y-2">
            {pendentes.map((u) => (
              <div key={u.id} className="bg-white rounded-xl p-3.5 flex items-center justify-between gap-3 flex-wrap" style={{ border: "1px solid #f0d9b8" }}>
                <div>
                  <div className="font-semibold text-sm">{u.email}</div>
                  <div className="text-[12px]" style={{ color: "var(--muted)" }}>Cadastrado {new Date(u.created_at).toLocaleDateString("pt-BR")}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => acao("aprovar", { userId: u.id })} className="flex items-center gap-1.5 text-white font-bold rounded-lg px-3 py-1.5 text-[13px]" style={{ background: "var(--green)" }}><UserCheck size={14} /> Aprovar</button>
                  <button onClick={() => acao("rejeitar", { userId: u.id })} className="flex items-center gap-1.5 font-bold rounded-lg px-3 py-1.5 text-[13px]" style={{ background: "#fdecec", color: "#d33" }}><UserX size={14} /> Rejeitar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* aprovados */}
      <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#8492a8" }}>Usuários ativos ({aprovados.length})</div>
      <div className="space-y-2">
        {aprovados.map((u) => {
          const at = tempoAtivo(u.ativoHaMin);
          const emEdicao = editando?.id === u.id;
          return (
            <div key={u.id} className="bg-white rounded-xl p-3.5" style={{ border: "1px solid var(--line)" }}>
              {!emEdicao ? (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full grid place-items-center text-[11px] font-bold" style={{ background: "#e8efff", color: "var(--blue)" }}>{(u.email || "?").slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {u.email}
                        {u.role === "admin" && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#eaf0ff", color: "var(--blue)" }}><Shield size={10} /> admin</span>}
                      </div>
                      <div className="text-[12px] flex items-center gap-1.5">
                        <span className="w-[6px] h-[6px] rounded-full" style={{ background: at.cor }} />
                        <span style={{ color: at.cor }}>{at.txt}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => { setEditando(u); setForm({ email: u.email, senha: "", nome: u.nome || "", role: u.role }); }} className="flex items-center gap-1 font-semibold rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: "#f0f3f7", color: "#65748b" }}><Pencil size={13} /> Editar</button>
                    <button onClick={() => acao("deslogar", { userId: u.id })} className="flex items-center gap-1 font-semibold rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: "#f0f3f7", color: "#65748b" }}><LogOut size={13} /> Deslogar</button>
                    <button onClick={() => { if (confirm(`Apagar ${u.email}? Esta ação é permanente.`)) acao("apagar", { userId: u.id }); }} className="flex items-center gap-1 font-semibold rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: "#fdecec", color: "#d33" }}><Trash2 size={13} /> Apagar</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grid sm:grid-cols-2 gap-2 mb-3">
                    <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
                    <input placeholder="Nova senha (deixe vazio p/ manter)" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
                    <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
                      <option value="viewer">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acao("editar", { userId: u.id, ...form })} className="flex items-center gap-1.5 text-white font-bold rounded-lg px-4 py-2 text-sm" style={{ background: "var(--green)" }}><Check size={15} /> Salvar</button>
                    <button onClick={() => setEditando(null)} className="flex items-center gap-1.5 font-semibold rounded-lg px-4 py-2 text-sm" style={{ background: "#f0f3f7", color: "#65748b" }}><X size={15} /> Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}