"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import {
  createArkanoidGame,
  type ArkanoidAction,
  type ArkanoidCallbacks,
  type ArkanoidGame,
} from "@/lib/games/arkanoid";
import type { GameCanvasHandle } from "@/lib/games/registry";

export type ArkanoidCanvasHandle = GameCanvasHandle;

interface ArkanoidCanvasProps extends ArkanoidCallbacks {
  ref?: Ref<ArkanoidCanvasHandle>;
  /** Id de skin (clasico | neon | retro); inválida → DEFAULT_SKIN. */
  skin?: string;
}

export default function ArkanoidCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onGameOver,
  skin,
}: ArkanoidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ArkanoidGame | null>(null);
  // Skin inicial para crear el motor sin recrearlo al cambiarla.
  const skinRef = useRef(skin);

  // Últimos callbacks: el juego no se recrea si el padre cambia las funciones
  const callbacksRef = useRef<ArkanoidCallbacks>({
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

    const game = createArkanoidGame(
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
      if (isArkanoidAction(action)) gameRef.current?.setInput(action, down);
    },
  }));

  const setInput = (action: ArkanoidAction, down: boolean) =>
    gameRef.current?.setInput(action, down);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="Juego Bloque Buster (Arkanoid)"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          aspectRatio: "4 / 3",
          touchAction: "none",
        }}
      />
      <div className="touch-controls touch-arkanoid" aria-hidden="true">
        <div className="touch-cluster touch-left">
          <TouchButton
            action="left"
            className="touch-rot"
            onInput={setInput}
            path="M15 5 7 12l8 7"
          />
        </div>
        <div className="touch-cluster touch-right">
          <TouchButton
            action="right"
            className="touch-rot"
            onInput={setInput}
            path="m9 5 8 7-8 7"
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
  action: ArkanoidAction;
  className: string;
  path: string;
  onInput: (action: ArkanoidAction, down: boolean) => void;
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

const ARKANOID_ACTIONS: readonly string[] = [
  "left",
  "right",
] satisfies readonly ArkanoidAction[];

function isArkanoidAction(action: string): action is ArkanoidAction {
  return ARKANOID_ACTIONS.includes(action);
}
