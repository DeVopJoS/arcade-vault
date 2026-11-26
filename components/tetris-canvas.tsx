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
  /** Id de skin (clasico | neon | retro); inválida → DEFAULT_SKIN. */
  skin?: string;
}

export default function TetrisCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onGameOver,
  skin,
}: TetrisCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TetrisGame | null>(null);
  // Skin inicial para crear el motor sin recrearlo al cambiarla.
  const skinRef = useRef(skin);

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

    const game = createTetrisGame(
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
      if (isTetrisAction(action)) gameRef.current?.setInput(action, down);
    },
  }));

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
    </>
  );
}

const TETRIS_ACTIONS: readonly string[] = [
  "left",
  "right",
  "down",
  "rotate",
  "drop",
] satisfies readonly TetrisAction[];

function isTetrisAction(action: string): action is TetrisAction {
  return TETRIS_ACTIONS.includes(action);
}
