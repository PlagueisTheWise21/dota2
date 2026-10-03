"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/** Pointer travel (px) before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

export type CardDrag<Target> = {
  teamId: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** Pointer position inside the card when the drag started. */
  offsetX: number;
  offsetY: number;
  /** Size of the pressed card, for drawing the copy that follows the pointer. */
  width: number;
  height: number;
  x: number;
  y: number;
  /** False until the pointer has moved past DRAG_THRESHOLD. */
  active: boolean;
  /** Where the team would land if dropped now. */
  target: Target | null;
};

type UseCardDragOptions<Target> = {
  /** The drop target under the pointer, or null for "nowhere". */
  findTarget: (x: number, y: number, teamId: string) => Target | null;
  /** Called when a team is dropped on a target. */
  onDrop: (teamId: string, target: Target) => void;
};

/**
 * Mouse/pen/touch dragging of team cards, shared by the tier list and the
 * predictions board. Escape cancels a drag.
 *
 * Returns the drag in progress (only once it has moved past the threshold)
 * and `startDrag`, to call from a card's onPointerDown.
 */
export function useCardDrag<Target>({
  findTarget,
  onDrop,
}: UseCardDragOptions<Target>) {
  const [drag, setDrag] = useState<CardDrag<Target> | null>(null);
  // Latest values for the window listeners (written only in handlers/effects).
  const dragRef = useRef<CardDrag<Target> | null>(null);
  const findTargetRef = useRef(findTarget);
  const onDropRef = useRef(onDrop);

  useEffect(() => {
    findTargetRef.current = findTarget;
    onDropRef.current = onDrop;
  });

  // While a press or drag is in progress, follow the pointer window-wide.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;

    function update(next: CardDrag<Target> | null) {
      dragRef.current = next;
      setDrag(next);
    }

    function handleMove(event: PointerEvent) {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const moved = Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY,
      );
      const active = current.active || moved > DRAG_THRESHOLD;
      update({
        ...current,
        x: event.clientX,
        y: event.clientY,
        active,
        target: active
          ? findTargetRef.current(event.clientX, event.clientY, current.teamId)
          : null,
      });
    }

    function handleUp(event: PointerEvent) {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (current.active && current.target) {
        onDropRef.current(current.teamId, current.target);
      }
      update(null);
    }

    function handleCancel() {
      update(null);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") update(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("keydown", handleKey);
    };
  }, [dragging]);

  function startDrag(event: ReactPointerEvent<HTMLElement>, teamId: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const next: CardDrag<Target> = {
      teamId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      x: event.clientX,
      y: event.clientY,
      active: false,
      target: null,
    };
    dragRef.current = next;
    setDrag(next);
  }

  return { drag: drag?.active ? drag : null, startDrag };
}
