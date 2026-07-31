import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente Supabase para uso no servidor (Server Components, Route Handlers).
// Lê a sessão do usuário a partir dos cookies.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado de um Server Component — pode ser ignorado se houver middleware
            // atualizando a sessão.
          }
        },
      },
    }
  );
}

// Cliente ADMIN (service role) — SÓ use em rotas de API server-side.
// Ignora RLS. Nunca importe isto em componentes client.
import { createClient as createAdminBase } from "@supabase/supabase-js";
export function createAdminClient() {
  return createAdminBase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
