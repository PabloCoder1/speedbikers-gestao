"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { LogIn, UserPlus } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setMsg("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else router.push("/");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg(error.message);
      else setMsg("Conta criada! Se a confirmação por email estiver ativa, verifique sua caixa. Depois faça login.");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Georgia, serif" }}>
          Speed Bikers <span className="text-sbgold">·</span> Gestão
        </div>
        <div className="text-sm text-slate-500 mt-1 mb-6">Acesse com seu email e senha</div>

        <label className="block text-sm font-semibold text-slate-600 mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4" placeholder="voce@empresa.com" />

        <label className="block text-sm font-semibold text-slate-600 mb-1">Senha</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-5" placeholder="••••••••" />

        {msg && <div className="text-sm mb-4 text-slate-700 bg-slate-100 rounded-lg px-3 py-2">{msg}</div>}

        <button onClick={submit} disabled={busy}
          className="w-full bg-sbblue text-white font-bold rounded-lg py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
          {mode === "login" ? <><LogIn size={18} /> Entrar</> : <><UserPlus size={18} /> Criar conta</>}
        </button>

        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }}
          className="w-full text-sm text-slate-500 mt-4 hover:text-slate-700">
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}
