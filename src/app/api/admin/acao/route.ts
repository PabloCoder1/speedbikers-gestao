import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

async function ehAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return prof?.role === "admin" ? user : null;
}

// POST /api/admin/acao  body: { acao, userId?, email?, senha?, nome?, role? }
export async function POST(req: Request) {
  const supabase = await createClient();
  const admin = await ehAdmin(supabase);
  if (!admin) return NextResponse.json({ error: "acesso negado" }, { status: 403 });

  const { acao, userId, email, senha, nome, role } = await req.json();
  const cli = createAdminClient();

  try {
    switch (acao) {
      case "aprovar":
        await cli.from("profiles").update({ status: "aprovado" }).eq("id", userId);
        return NextResponse.json({ ok: true, msg: "Usuário aprovado" });

      case "rejeitar":
        // rejeitar = apaga o usuário do auth e o profile
        await cli.auth.admin.deleteUser(userId);
        await cli.from("profiles").delete().eq("id", userId);
        return NextResponse.json({ ok: true, msg: "Usuário rejeitado e removido" });

      case "apagar":
        await cli.auth.admin.deleteUser(userId);
        await cli.from("profiles").delete().eq("id", userId);
        return NextResponse.json({ ok: true, msg: "Usuário apagado" });

      case "deslogar":
        // invalida as sessões do usuário (obriga novo login)
        await cli.auth.admin.signOut(userId);
        return NextResponse.json({ ok: true, msg: "Usuário deslogado" });

      case "editar": {
        const patch: any = {};
        if (email) patch.email = email;
        if (senha) patch.password = senha;
        if (Object.keys(patch).length) await cli.auth.admin.updateUserById(userId, patch);
        const profPatch: any = {};
        if (email) profPatch.email = email;
        if (nome !== undefined) profPatch.nome = nome;
        if (role) profPatch.role = role;
        if (Object.keys(profPatch).length) await cli.from("profiles").update(profPatch).eq("id", userId);
        return NextResponse.json({ ok: true, msg: "Usuário atualizado" });
      }

      case "criar": {
        // cria usuário já aprovado (manual pelo admin)
        const { data: novo, error } = await cli.auth.admin.createUser({
          email, password: senha, email_confirm: true,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await cli.from("profiles").upsert({
          id: novo.user.id, email, nome: nome || null,
          role: role || "viewer", status: "aprovado",
        });
        return NextResponse.json({ ok: true, msg: "Usuário criado e aprovado" });
      }

      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "falha" }, { status: 500 });
  }
}
