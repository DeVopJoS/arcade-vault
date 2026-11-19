"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status =
  { state: "loading" } | { state: "ok" } | { state: "error"; message: string };

export function BrowserCheck() {
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    async function check() {
      try {
        // Crea el cliente (valida las variables) y comprueba URL + key contra el proyecto.
        createClient();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
            },
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStatus({ state: "ok" });
      } catch (e) {
        setStatus({
          state: "error",
          message: e instanceof Error ? e.message : "Error desconocido",
        });
      }
    }
    check();
  }, []);

  if (status.state === "loading")
    return <span className="dim">COMPROBANDO…</span>;
  if (status.state === "ok") return <span className="line">CONEXIÓN OK</span>;
  return <span style={{ color: "#ff3060" }}>ERROR: {status.message}</span>;
}
