import type { ComponentType, Ref } from "react";
import ArkanoidCanvas from "@/components/arkanoid-canvas";
import AsteroidsCanvas from "@/components/asteroids-canvas";
import TetrisCanvas from "@/components/tetris-canvas";

export interface GameCanvasHandle {
  pause(): void;
  resume(): void;
  restart(): void;
}

export interface GameCanvasProps {
  ref?: Ref<GameCanvasHandle>;
  onScore: (n: number) => void;
  onLives: (n: number) => void;
  onLevel: (n: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameEntry {
  component: ComponentType<GameCanvasProps>;
  hasLives: boolean;
}

// gameId → juego real. Los ids sin entrada siguen con la simulación de GamePlayer.
export const GAME_CANVASES: Record<string, GameEntry> = {
  rocas: { component: AsteroidsCanvas, hasLives: true },
  caida: { component: TetrisCanvas, hasLives: false },
  "bloque-buster": { component: ArkanoidCanvas, hasLives: true },
};
