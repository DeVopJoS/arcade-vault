"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import {
  createAsteroidsGame,
  type AsteroidsCallbacks,
  type AsteroidsGame,
} from "@/lib/games/asteroids";

export interface AsteroidsCanvasHandle {
  pause(): void;
  resume(): void;
  restart(): void;
}

interface AsteroidsCanvasProps extends AsteroidsCallbacks {
  ref?: Ref<AsteroidsCanvasHandle>;
}

export default function AsteroidsCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onGameOver,
}: AsteroidsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);

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

    const game = createAsteroidsGame(canvas, {
      onScore: (v) => callbacksRef.current.onScore(v),
      onLives: (v) => callbacksRef.current.onLives(v),
      onLevel: (v) => callbacksRef.current.onLevel(v),
      onGameOver: (v) => callbacksRef.current.onGameOver(v),
    });
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

  return (
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
  );
}
