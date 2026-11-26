"use client";

import { useEffect, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { GamepadLayout, GamepadSlot } from "@/lib/games/registry";

interface GamepadProps {
  layout: GamepadLayout;
  onInput: (action: string, down: boolean) => void;
  /** En pausa / fin: no envía acciones y suelta las sostenidas. */
  disabled: boolean;
}

const DIRS: { slot: GamepadSlot; label: string; path: string }[] = [
  { slot: "up", label: "Arriba", path: "M6 15l6-7 6 7z" },
  { slot: "left", label: "Izquierda", path: "M15 6l-7 6 7 6z" },
  { slot: "right", label: "Derecha", path: "M9 6l7 6-7 6z" },
  { slot: "down", label: "Abajo", path: "M6 9l6 7 6-7z" },
];

const FACE: { slot: "a" | "b"; key: string }[] = [
  { slot: "b", key: "B" },
  { slot: "a", key: "A" },
];

export function Gamepad({ layout, onInput, disabled }: GamepadProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // pointerId → acción sostenida (multitáctil: D-pad + A a la vez)
  const heldRef = useRef(new Map<number, string>());
  const onInputRef = useRef(onInput);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onInputRef.current = onInput;
    disabledRef.current = disabled;
  });

  const releaseAll = () => {
    for (const action of heldRef.current.values()) {
      onInputRef.current(action, false);
    }
    heldRef.current.clear();
    rootRef.current
      ?.querySelectorAll("[data-pressed]")
      .forEach((el) => el.removeAttribute("data-pressed"));
  };

  // Al pausar/terminar, al ocultar la pestaña o al desmontar: nada queda pegado
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) releaseAll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      releaseAll();
    };
  }, []);

  const press = (e: ReactPointerEvent<HTMLButtonElement>, action: string) => {
    e.preventDefault();
    if (disabledRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.setAttribute("data-pressed", "");
    heldRef.current.set(e.pointerId, action);
    onInputRef.current(action, true);
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // Sin háptica: silencioso
      }
    }
  };

  const release = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const action = heldRef.current.get(e.pointerId);
    if (action === undefined) return; // pointerup y lostpointercapture: una sola vez
    heldRef.current.delete(e.pointerId);
    if (![...heldRef.current.values()].includes(action)) {
      e.currentTarget.removeAttribute("data-pressed");
    }
    onInputRef.current(action, false);
  };

  const handlers = (action: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) =>
      press(e, action),
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });

  return (
    <div
      ref={rootRef}
      className="gamepad"
      role="group"
      aria-label="Controles"
      data-disabled={disabled || undefined}
    >
      <div className="gp-dpad">
        {DIRS.map(({ slot, label, path }) => {
          const btn = layout[slot];
          return (
            <button
              key={slot}
              type="button"
              tabIndex={-1}
              className={`gp-btn gp-dir gp-${slot}`}
              aria-label={label}
              aria-hidden={btn ? undefined : true}
              disabled={!btn}
              {...(btn ? handlers(btn.action) : {})}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={path} fill="currentColor" />
              </svg>
            </button>
          );
        })}
        <span className="gp-hub" aria-hidden="true" />
      </div>

      <div className="gp-face">
        {FACE.map(({ slot, key }) => {
          const btn = layout[slot];
          return (
            <div key={slot} className={`gp-key gp-key-${slot}`}>
              <button
                type="button"
                tabIndex={-1}
                className={`gp-btn gp-round gp-${slot}`}
                aria-label={btn?.label ?? key}
                aria-hidden={btn ? undefined : true}
                disabled={!btn}
                {...(btn ? handlers(btn.action) : {})}
              >
                {key}
              </button>
              <span className="gp-label" aria-hidden="true">
                {btn?.label ?? ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
