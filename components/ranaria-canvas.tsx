"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import {
  createRanariaGame,
  type RanariaAction,
  type RanariaCallbacks,
  type RanariaGame,
} from "@/lib/games/ranaria";
import type { GameCanvasHandle } from "@/lib/games/registry";

export type RanariaCanvasHandle = GameCanvasHandle;

interface RanariaCanvasProps extends RanariaCallbacks {
  ref?: Ref<RanariaCanvasHandle>;
  /** Id de skin (clasico | neon | retro); inválida → DEFAULT_SKIN. */
  skin?: string;
}

export default function RanariaCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onGameOver,
  skin,
}: RanariaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RanariaGame | null>(null);
  // Skin inicial para crear el motor sin recrearlo al cambiarla.
  const skinRef = useRef(skin);

  // Últimos callbacks: el juego no se recrea si el padre cambia las funciones
  const callbacksRef = useRef<RanariaCallbacks>({
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

    const game = createRanariaGame(
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
      if (isRanariaAction(action)) gameRef.current?.setInput(action, down);
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      aria-label="Juego Ranaria (cruce de carretera y río)"
      style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        height: "100%",
        aspectRatio: "8 / 7",
      }}
    />
  );
}

const RANARIA_ACTIONS: readonly string[] = [
  "up",
  "down",
  "left",
  "right",
] satisfies readonly RanariaAction[];

function isRanariaAction(action: string): action is RanariaAction {
  return RANARIA_ACTIONS.includes(action);
}
