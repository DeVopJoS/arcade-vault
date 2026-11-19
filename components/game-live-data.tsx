"use client";

import { useEffect, useState } from "react";
import {
  fetchGameStats,
  fetchLeaderboard,
  type GameStats,
  type LeaderboardRow,
} from "@/lib/scores";

interface Loaded<T> {
  gameId: string;
  data?: T;
  error?: string;
}

// Carga por juego; descarta respuestas de un juego anterior
function useRemote<T>(gameId: string, load: (id: string) => Promise<T>) {
  const [result, setResult] = useState<Loaded<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(gameId)
      .then((data) => {
        if (!cancelled) setResult({ gameId, data });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResult({
            gameId,
            error: e instanceof Error ? e.message : "Error desconocido",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, load]);

  const current = result?.gameId === gameId ? result : null;
  return {
    loading: current === null,
    data: current?.data,
    error: current?.error ?? null,
  };
}

const EMPTY = "—";

// Celdas de la franja de estadísticas (se insertan dentro de `.stat-strip`)
export function GameStatCells({ gameId }: { gameId: string }) {
  const { loading, data, error } = useRemote<GameStats>(gameId, fetchGameStats);
  const ready = !loading && !error && data;
  const fmt = (n: number | undefined) =>
    ready && n !== undefined ? n.toLocaleString("es-ES") : EMPTY;

  return (
    <>
      <div>
        <div className="l">Partidas</div>
        <div className="v">{fmt(data?.plays)}</div>
      </div>
      <div>
        <div className="l">Jugadores</div>
        <div className="v">{fmt(data?.players)}</div>
      </div>
      <div>
        <div className="l">Mejor global</div>
        <div
          className="v"
          style={{
            color: "var(--magenta)",
            textShadow: "0 0 6px rgba(255,0,110,0.5)",
          }}
          title={error ?? undefined}
        >
          {fmt(data?.best)}
        </div>
      </div>
    </>
  );
}

// Referencia estable: useRemote la usa como dependencia del efecto
const fetchTop10 = (id: string) => fetchLeaderboard(id, 10);

export function GameLeaderboard({ gameId }: { gameId: string }) {
  const { loading, data, error } = useRemote<LeaderboardRow[]>(
    gameId,
    fetchTop10,
  );
  const rows = data ?? [];

  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {loading && (
        <p className="pixel" style={{ fontSize: 10, padding: 16 }}>
          CARGANDO_
        </p>
      )}
      {error && (
        <p
          className="pixel"
          role="alert"
          style={{ fontSize: 10, padding: 16, color: "var(--magenta)" }}
        >
          NO SE PUDO CARGAR EL RANKING
        </p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p
          className="pixel"
          style={{ fontSize: 10, padding: 16, color: "var(--ink-dim)" }}
        >
          AÚN SIN PUNTAJES — SÉ EL PRIMERO
        </p>
      )}
      {rows.map((r, i) => (
        <div
          key={r.name}
          className={
            "lb-row" +
            (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
          }
        >
          <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
          <div className="pl">
            {r.name}
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                letterSpacing: "0.1em",
              }}
            >
              {r.date}
            </div>
          </div>
          <div className="sc">{r.score.toLocaleString("es-ES")}</div>
        </div>
      ))}
    </div>
  );
}
