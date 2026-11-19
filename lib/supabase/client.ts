import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Referencias estáticas: Next solo inlinea NEXT_PUBLIC_* si se acceden por nombre literal.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return createBrowserClient(url, key);
}
