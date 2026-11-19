import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { BrowserCheck } from "./browser-check";

// Devuelve null si la conexión responde, o el mensaje de error.
async function checkConnection(): Promise<string | null> {
  try {
    // Crea el cliente (valida las variables) y comprueba URL + key contra el proyecto.
    await createClient();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return `HTTP ${res.status}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Error desconocido";
  }
}

async function ServerCheck() {
  const error = await checkConnection();
  if (error) return <span style={{ color: "#ff3060" }}>ERROR: {error}</span>;
  return <span className="line">CONEXIÓN OK</span>;
}

export default function SupabaseTestPage() {
  return (
    <section className="home-section">
      <div className="section-head">
        <span className="kicker">SPEC 04</span>
        <h1 className="section-title">PRUEBA SUPABASE</h1>
        <div className="section-rule" />
      </div>

      <div className="terminal-success">
        <div className="term-bar">
          <span className="dot r" />
          <span className="dot y" />
          <span className="dot g" />
          <span className="term-title">SUPABASE://CONEXION</span>
        </div>
        <div className="term-body">
          <div>
            <span className="prompt">&gt;</span>
            <span className="dim">SERVIDOR · </span>
            <Suspense fallback={<span className="dim">COMPROBANDO…</span>}>
              <ServerCheck />
            </Suspense>
          </div>
          <div>
            <span className="prompt">&gt;</span>
            <span className="dim">NAVEGADOR · </span>
            <BrowserCheck />
          </div>
        </div>
      </div>
    </section>
  );
}
