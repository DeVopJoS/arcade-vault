"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import {
  createAsteroidsGame,
  type AsteroidsAction,
  type AsteroidsCallbacks,
  type AsteroidsGame,
} from "@/lib/games/asteroids";
import type { GameCanvasHandle } from "@/lib/games/registry";

export type AsteroidsCanvasHandle = GameCanvasHandle;

interface AsteroidsCanvasProps extends AsteroidsCallbacks {
  ref?: Ref<AsteroidsCanvasHandle>;
  /** Id de skin (clasico | neon | retro); inválida → DEFAULT_SKIN. */
  skin?: string;
}

export default function AsteroidsCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onGameOver,
  skin,
}: AsteroidsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);
  // Skin inicial para crear el motor sin recrearlo al cambiarla.
  const skinRef = useRef(skin);

  // Últimos callbacks: el juego no se recrea si el padre cambia las funciones
  const callbacksRef = useRef<AsteroidsCallbacks>({
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

    const game = createAsteroidsGame(
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
  }));

  const setInput = (action: AsteroidsAction, down: boolean) =>
    gameRef.current?.setInput(action, down);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="Juego Asteroides"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          aspectRatio: "4 / 3",
        }}
      />
      <div className="touch-controls" aria-hidden="true">
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
            action="thrust"
            className="touch-thrust"
            onInput={setInput}
            path="M12 4 5 16h14z"
          />
          <TouchButton
            action="fire"
            className="touch-fire"
            onInput={setInput}
            path="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
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
  action: AsteroidsAction;
  className: string;
  path: string;
  onInput: (action: AsteroidsAction, down: boolean) => void;
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
          fill={className === "touch-rot" ? "none" : "currentColor"}
          fillOpacity={0.25}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
