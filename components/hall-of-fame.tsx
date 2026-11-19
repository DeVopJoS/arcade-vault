"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GAMES } from "@/lib/data";
import { fetchLeaderboard, type LeaderboardRow } from "@/lib/scores";

interface LoadResult {
  tab: string;
  rows?: LeaderboardRow[];
  error?: string;
}

export function HallOfFame() {
  const [tab, setTab] = useState(GAMES[0].id);
  const [result, setResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    // Evita mostrar datos de una pestaña anterior si la respuesta llega tarde
    let cancelled = false;
    fetchLeaderboard(tab)
      .then((rows) => {
        if (!cancelled) setResult({ tab, rows });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResult({
            tab,
            error: e instanceof Error ? e.message : "Error desconocido",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  // Solo vale el resultado de la pestaña activa; si no, estamos cargando
  const current = result?.tab === tab ? result : null;
  const rows = current?.rows ?? [];
  const loading = current === null;
  const error = current?.error ?? null;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {loading && (
        <p className="pixel" style={{ fontSize: 10, textAlign: "center" }}>
          CARGANDO SALÓN_
        </p>
      )}

      {error && (
        <p
          className="pixel"
          role="alert"
          style={{ fontSize: 10, textAlign: "center", color: "var(--magenta)" }}
        >
          ERROR: {error}
        </p>
      )}

      {!loading && !error && rows.length >= 3 && (
        <div className="podium">
          <div className="podium-slot silver">
            <div className="rank-num">02</div>
            <div className="name">{rows[1].name}</div>
            <div className="score">{rows[1].score.toLocaleString("es-ES")}</div>
            <div className="date">{rows[1].date}</div>
          </div>
          <div className="podium-slot gold">
            <div
              className="pixel"
              style={{
                fontSize: 9,
                color: "var(--gold)",
                letterSpacing: "0.18em",
              }}
            >
              CAMPEÓN
            </div>
            <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
              01
            </div>
            <div className="name">{rows[0].name}</div>
            <div className="score" style={{ fontSize: 20 }}>
              {rows[0].score.toLocaleString("es-ES")}
            </div>
            <div className="date">{rows[0].date}</div>
          </div>
          <div className="podium-slot bronze">
            <div className="rank-num">03</div>
            <div className="name">{rows[2].name}</div>
            <div className="score">{rows[2].score.toLocaleString("es-ES")}</div>
            <div className="date">{rows[2].date}</div>
          </div>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="hall-table">
          <div className="th">
            <div>RANGO</div>
            <div>JUGADOR</div>
            <div>PUNTUACIÓN</div>
            <div>FECHA</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.name + i}
              className={
                "tr" +
                (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
              }
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
              <div className="pl">{r.name}</div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
              <div className="dt">{r.date}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/juegos" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
