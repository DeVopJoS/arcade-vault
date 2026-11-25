import type { ComponentType, Ref } from "react";
import ArkanoidCanvas from "@/components/arkanoid-canvas";
import AsteroidsCanvas from "@/components/asteroids-canvas";
import SnakeCanvas from "@/components/snake-canvas";
import TetrisCanvas from "@/components/tetris-canvas";
import * as arkanoid from "@/lib/games/arkanoid";
import * as asteroids from "@/lib/games/asteroids";
import * as snake from "@/lib/games/snake";
import * as tetris from "@/lib/games/tetris";

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
  /** Skin activa (solo juegos con `skins` en su entrada). */
  skin?: string;
}

export interface SkinOption {
  id: string;
  name: string;
  /** Muestra para el selector: [fondo, cuerpo, acento]. */
  swatch: readonly [string, string, string];
}

export interface GameEntry {
  component: ComponentType<GameCanvasProps>;
  hasLives: boolean;
  /** Skins disponibles; el selector se muestra solo si existen. */
  skins?: readonly SkinOption[];
  defaultSkin?: string;
}

// gameId → juego real. Los ids sin entrada siguen con la simulación de GamePlayer.
export const GAME_CANVASES: Record<string, GameEntry> = {
  rocas: {
    component: AsteroidsCanvas,
    hasLives: true,
    skins: asteroids.SKIN_OPTIONS,
    defaultSkin: asteroids.DEFAULT_SKIN,
  },
  caida: {
    component: TetrisCanvas,
    hasLives: false,
    skins: tetris.SKIN_OPTIONS,
    defaultSkin: tetris.DEFAULT_SKIN,
  },
  "bloque-buster": {
    component: ArkanoidCanvas,
    hasLives: true,
    skins: arkanoid.SKIN_OPTIONS,
    defaultSkin: arkanoid.DEFAULT_SKIN,
  },
  serpentina: {
    component: SnakeCanvas,
    hasLives: false,
    skins: snake.SKIN_OPTIONS,
    defaultSkin: snake.DEFAULT_SKIN,
  },
};
