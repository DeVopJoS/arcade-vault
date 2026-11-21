"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { CSSProperties, Ref } from "react";
import {
  createSnakeGame,
  type SnakeAction,
  type SnakeCallbacks,
  type SnakeGame,
} from "@/lib/games/snake";
import type { GameCanvasHandle } from "@/lib/games/registry";

export type SnakeCanvasHandle = GameCanvasHandle;

interface SnakeCanvasProps extends SnakeCallbacks {
  ref?: Ref<SnakeCanvasHandle>;
}

// D-pad provisional (se pule en el paso 7): cruz de 4 botones.
const DPAD: {
  action: SnakeAction;
  label: string;
  path: string;
  style: CSSProperties;
}[] = [
  {
    action: "up",
    label: "Arriba",
    path: "M5 15l7-8 7 8",
    style: { gridColumn: 2, gridRow: 1 },
  },
  {
    action: "left",
    label: "Izquierda",
    path: "M15 5 7 12l8 7",
    style: { gridColumn: 1, gridRow: 2 },
  },
  {
    action: "down",
    label: "Abajo",
    path: "M5 9l7 8 7-8",
    style: { gridColumn: 2, gridRow: 2 },
  },
  {
    action: "right",
    label: "Derecha",
    path: "m9 5 8 7-8 7",
    style: { gridColumn: 3, gridRow: 2 },
  },
];

export default function SnakeCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onGameOver,
}: SnakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnakeGame | null>(null);

  // Últimos callbacks: el juego no se recrea si el padre cambia las funciones
  const callbacksRef = useRef<SnakeCallbacks>({
    onScore,
    onLives,
    onLevel,
    onGameOver,
  });
  useEffect(() => {
    callbacksRef.current = { onScore, onLives, onLevel, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // El canvas no entiende var(--green): se resuelve a su valor real
    const color =
      getComputedStyle(canvas).getPropertyValue("--green").trim() || "#00ff88";

    const game = createSnakeGame(
      canvas,
      {
        onScore: (v) => callbacksRef.current.onScore(v),
        onLives: (v) => callbacksRef.current.onLives(v),
        onLevel: (v) => callbacksRef.current.onLevel(v),
        onGameOver: (v) => callbacksRef.current.onGameOver(v),
      },
      { color },
    );
    gameRef.current = game;
    game.start();

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    pause: () => gameRef.current?.pause(),
    resume: () => gameRef.current?.resume(),
    restart: () => gameRef.current?.restart(),
  }));

  const setInput = (action: SnakeAction, down: boolean) =>
    gameRef.current?.setInput(action, down);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="Juego Serpentina (Snake)"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          aspectRatio: "4 / 3",
          touchAction: "none",
        }}
      />
      <div className="touch-controls touch-snake" aria-hidden="true">
        <div
          className="touch-cluster"
          style={{
            marginLeft: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(3, auto)",
            gridTemplateRows: "repeat(2, auto)",
            gap: 6,
          }}
        >
          {DPAD.map((b) => (
            <button
              key={b.action}
              type="button"
              tabIndex={-1}
              aria-label={b.label}
              className="touch-btn touch-rot"
              style={b.style}
              onPointerDown={(e) => {
                e.preventDefault();
                setInput(b.action, true);
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <svg viewBox="0 0 24 24" width="100%" height="100%">
                <path
                  d={b.path}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
