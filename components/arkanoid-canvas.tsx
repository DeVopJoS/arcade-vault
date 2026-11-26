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
    </>
  );
}

const ARKANOID_ACTIONS: readonly string[] = [
  "left",
  "right",
] satisfies readonly ArkanoidAction[];

function isArkanoidAction(action: string): action is ArkanoidAction {
  return ARKANOID_ACTIONS.includes(action);
}
