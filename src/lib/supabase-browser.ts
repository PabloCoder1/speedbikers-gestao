"use client";
import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase para uso no navegador (componentes client).
// Usa apenas a ANON KEY, que é pública e segura para o front.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
