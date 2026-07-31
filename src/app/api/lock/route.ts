import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// POST /api/lock  body: { locked: boolean }
// Só ADMIN pode alterar. A verificação é feita no servidor (não confia no client).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "apenas admin pode bloquear" }, { status: 403 });

  const { locked } = await req.json();
  const { error } = await supabase
    .from("app_state")
    .update({ locked: !!locked, locked_by: user.id, locked_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, locked: !!locked });
}

// GET /api/lock -> estado atual
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("app_state").select("locked").eq("id", 1).single();
  return NextResponse.json({ locked: data?.locked ?? false });
}
