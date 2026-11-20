"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import {
  createTetrisGame,
  type TetrisAction,
  type TetrisCallbacks,
  type TetrisGame,
} from "@/lib/games/tetris";
import type { GameCanvasHandle } from "@/lib/games/registry";

export type TetrisCanvasHandle = GameCanvasHandle;

interface TetrisCanvasProps extends TetrisCallbacks {
  ref?: Ref<TetrisCanvasHandle>;
}

export default function TetrisCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onGameOver,
}: TetrisCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TetrisGame | null>(null);

  // Últimos callbacks: el juego no se recrea si el padre cambia las funciones
  const callbacksRef = useRef<TetrisCallbacks>({
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

    // El canvas no entiende var(--magenta): se resuelve a su valor real
    const color =
      getComputedStyle(canvas).getPropertyValue("--magenta").trim() ||
      "#ff006e";

    const game = createTetrisGame(
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

  const setInput = (action: TetrisAction, down: boolean) =>
    gameRef.current?.setInput(action, down);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="Juego Caída (Tetris)"
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          height: "100%",
          aspectRatio: "4 / 5",
        }}
      />
      <div className="touch-controls touch-tetris" aria-hidden="true">
        <div className="touch-cluster touch-left">
          <TouchButton
            action="left"
            className="touch-rot"
            onInput={setInput}
            path="M15 5 7 12l8 7"
          />
          <TouchButton
            action="right"
            className="touch-rot"
            onInput={setInput}
            path="m9 5 8 7-8 7"
          />
        </div>
        <div className="touch-cluster touch-right">
          <TouchButton
            action="rotate"
            className="touch-thrust"
            onInput={setInput}
            path="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"
          />
          <TouchButton
            action="down"
            className="touch-rot"
            onInput={setInput}
            path="m5 9 7 7 7-7"
          />
          <TouchButton
            action="drop"
            className="touch-fire"
            onInput={setInput}
            path="m6 6 6 6 6-6M6 13l6 6 6-6"
          />
        </div>
      </div>
    </>
  );
}

function TouchButton({
  action,
  className,
  path,
  onInput,
}: {
  action: TetrisAction;
  className: string;
  path: string;
  onInput: (action: TetrisAction, down: boolean) => void;
}) {
  const release = () => onInput(action, false);
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`touch-btn ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onInput(action, true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%">
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
