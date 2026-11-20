"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/data";
import { useSession } from "@/components/session-provider";
import { submitScore } from "@/lib/scores";
import { GAME_CANVASES, type GameCanvasHandle } from "@/lib/games/registry";

export function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // null = sin edición manual: usa el nombre de la sesión (hidratada tras el mount)
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const name = nameInput ?? user?.name ?? "INVITADO";

  // Sin entrada en el registro, el juego sigue con la simulación
  const entry = GAME_CANVASES[game.id];
  const hasRealGame = entry !== undefined;
  const gameRef = useRef<GameCanvasHandle>(null);

  useEffect(() => {
    if (hasRealGame || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [hasRealGame, over, paused]);

  useEffect(() => {
    if (hasRealGame) return;
    // Replica tal cual la plantilla (simulación decorativa)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [hasRealGame, score]);

  const togglePause = (e: MouseEvent<HTMLButtonElement>) => {
    // Quita el foco para que Espacio no vuelva a activar el botón
    e.currentTarget.blur();
    const next = !paused;
    setPaused(next);
    if (next) gameRef.current?.pause();
    else gameRef.current?.resume();
  };
  const endGame = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    gameRef.current?.pause();
    setOver(true);
  };
  const restart = () => {
    gameRef.current?.restart();
    setScore(0);
    if (entry?.hasLives ?? true) setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaving(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (saving || saved) return;
    if (!name.trim()) {
      setSaveError("ESCRIBE TUS INICIALES");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await submitScore({ gameId: game.id, name, score });
    setSaving(false);
    if (res.ok) {
      // Respaldo local de SPEC 01 (sin cambios)
      saveScore({ game: game.id, score, name });
      setSaved(true);
    } else {
      setSaveError(`ERROR: ${res.message}`);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          {(entry?.hasLives ?? true) && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juegos/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {entry ? (
            <entry.component
              ref={gameRef}
              onScore={setScore}
              onLives={setLives}
              onLevel={setLevel}
              onGameOver={(finalScore) => {
                setScore(finalScore);
                setOver(true);
              }}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setNameInput(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? "GUARDANDO_" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveError && !saved && (
              <div
                className="pixel"
                role="alert"
                style={{ fontSize: 10, color: "var(--magenta)", marginTop: 10 }}
              >
                {saveError}
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/juegos")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
