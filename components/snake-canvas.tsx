"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
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
  /** Id de skin (clasico | neon | retro); inválida → DEFAULT_SKIN. */
  skin?: string;
}

// D-pad en cruz; la posición de cada botón vive en CSS (.touch-snake .touch-dp-*).
const DPAD: { action: SnakeAction; label: string; path: string }[] = [
  { action: "up", label: "Arriba", path: "M5 15l7-8 7 8" },
  { action: "left", label: "Izquierda", path: "M15 5 7 12l8 7" },
  { action: "down", label: "Abajo", path: "M5 9l7 8 7-8" },
  { action: "right", label: "Derecha", path: "m9 5 8 7-8 7" },
];

export default function SnakeCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onGameOver,
  skin,
}: SnakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnakeGame | null>(null);
  // Skin inicial para crear el motor sin recrearlo al cambiarla.
  const skinRef = useRef(skin);

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

    const game = createSnakeGame(
      canvas,
      {
        onScore: (v) => callbacksRef.current.onScore(v),
        onLives: (v) => callbacksRef.current.onLives(v),
        onLevel: (v) => callbacksRef.current.onLevel(v),
        onGameOver: (v) => callbacksRef.current.onGameOver(v),
      },
      { skin: skinRef.current },
    );
    gameRef.current = game;
    game.start();

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  // Cambio de skin en caliente: solo redibuja, la partida sigue.
  useEffect(() => {
    skinRef.current = skin;
    gameRef.current?.setSkin(skin ?? "");
  }, [skin]);

  useImperativeHandle(ref, () => ({
    pause: () => gameRef.current?.pause(),
    resume: () => gameRef.current?.resume(),
    restart: () => gameRef.current?.restart(),
    // Gamepad genérico (SPEC 10): solo se reenvían acciones válidas del juego
    setInput: (action: string, down: boolean) => {
      if (isSnakeAction(action)) gameRef.current?.setInput(action, down);
    },
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
        <div className="touch-cluster">
          {DPAD.map((b) => (
            <button
              key={b.action}
              type="button"
              tabIndex={-1}
              aria-label={b.label}
              className={`touch-btn touch-rot touch-dp-${b.action}`}
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

const SNAKE_ACTIONS: readonly string[] = [
  "up",
  "down",
  "left",
  "right",
] satisfies readonly SnakeAction[];

function isSnakeAction(action: string): action is SnakeAction {
  return SNAKE_ACTIONS.includes(action);
}
