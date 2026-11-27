import type { ComponentType, Ref } from "react";
import ArkanoidCanvas from "@/components/arkanoid-canvas";
import AsteroidsCanvas from "@/components/asteroids-canvas";
import RanariaCanvas from "@/components/ranaria-canvas";
import SnakeCanvas from "@/components/snake-canvas";
import TetrisCanvas from "@/components/tetris-canvas";
import * as arkanoid from "@/lib/games/arkanoid";
import * as asteroids from "@/lib/games/asteroids";
import * as ranaria from "@/lib/games/ranaria";
import * as snake from "@/lib/games/snake";
import * as tetris from "@/lib/games/tetris";

export interface GameCanvasHandle {
  pause(): void;
  resume(): void;
  restart(): void;
  /** Entrada del gamepad (SPEC 10); acción desconocida → se ignora. */
  setInput(action: string, down: boolean): void;
}

export type GamepadSlot = "up" | "down" | "left" | "right" | "a" | "b";

export interface GamepadButton {
  /** Acción que se pasa a GameCanvasHandle.setInput. */
  action: string;
  /** Etiqueta corta bajo A/B (opcional en el D-pad). */
  label?: string;
}

/** Slots sin entrada se muestran apagados (deshabilitados). */
export type GamepadLayout = Partial<Record<GamepadSlot, GamepadButton>>;

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
  /** Controles táctiles; sin campo → no se muestra gamepad. */
  gamepad?: GamepadLayout;
}

// gameId → juego real. Los ids sin entrada siguen con la simulación de GamePlayer.
export const GAME_CANVASES: Record<string, GameEntry> = {
  rocas: {
    component: AsteroidsCanvas,
    hasLives: true,
    skins: asteroids.SKIN_OPTIONS,
    defaultSkin: asteroids.DEFAULT_SKIN,
    gamepad: {
      up: { action: "thrust" },
      left: { action: "left" },
      right: { action: "right" },
      a: { action: "fire", label: "DISPARO" },
    },
  },
  caida: {
    component: TetrisCanvas,
    hasLives: false,
    skins: tetris.SKIN_OPTIONS,
    defaultSkin: tetris.DEFAULT_SKIN,
    gamepad: {
      down: { action: "down" },
      left: { action: "left" },
      right: { action: "right" },
      a: { action: "rotate", label: "ROTAR" },
      b: { action: "drop", label: "CAÍDA" },
    },
  },
  "bloque-buster": {
    component: ArkanoidCanvas,
    hasLives: true,
    skins: arkanoid.SKIN_OPTIONS,
    defaultSkin: arkanoid.DEFAULT_SKIN,
    gamepad: {
      left: { action: "left" },
      right: { action: "right" },
    },
  },
  serpentina: {
    component: SnakeCanvas,
    hasLives: false,
    skins: snake.SKIN_OPTIONS,
    defaultSkin: snake.DEFAULT_SKIN,
    gamepad: {
      up: { action: "up" },
      down: { action: "down" },
      left: { action: "left" },
      right: { action: "right" },
    },
  },
  // gamepad: lo agrega mobile-porter (SPEC 10)
  ranaria: {
    component: RanariaCanvas,
    hasLives: true,
    skins: ranaria.SKIN_OPTIONS,
    defaultSkin: ranaria.DEFAULT_SKIN,
  },
};
