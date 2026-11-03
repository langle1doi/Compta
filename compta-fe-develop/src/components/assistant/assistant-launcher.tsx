"use client";

import { Bot } from "lucide-react";
import { motion, useMotionValue, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";

import { useAssistant } from "./assistant-provider";
import {
  clampPoint,
  useDraggablePosition,
  useViewportSize,
} from "./hooks/use-draggable-position";

const LAUNCHER = 56;
const DRAG_THRESHOLD = 5;

export function AssistantLauncher() {
  const t = useTranslations("assistant");
  const { openAssistant, launcherRef, launcherPoint, setLauncherPoint } =
    useAssistant();
  const reduceMotion = useReducedMotion();
  const viewport = useViewportSize();
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  const defaultFactory = useCallback(
    (vp: { width: number; height: number }) => ({
      x: vp.width - LAUNCHER - 24,
      y: vp.height - LAUNCHER - 24,
    }),
    [],
  );

  const { point, setPoint, dragConstraints, ready } = useDraggablePosition({
    defaultFactory,
    sizeFallback: { width: LAUNCHER, height: LAUNCHER },
  });

  const activePoint = launcherPoint ?? point;
  const x = useMotionValue(activePoint.x);
  const y = useMotionValue(activePoint.y);

  useEffect(() => {
    x.set(activePoint.x);
    y.set(activePoint.y);
  }, [activePoint.x, activePoint.y, x, y]);

  return (
    <motion.button
      aria-label={t("launcher.open")}
      className="assistant-launcher fixed z-[55]"
      drag
      dragConstraints={dragConstraints}
      dragElastic={0}
      dragMomentum={false}
      ref={launcherRef}
      style={{ left: 0, top: 0, x, y, opacity: ready ? 1 : 0 }}
      transition={
        reduceMotion === true
          ? { duration: 0.01 }
          : { type: "tween", duration: 0.18, ease: "easeOut" }
      }
      type="button"
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      onClick={() => {
        if (moved.current) return;
        openAssistant();
      }}
      onDragEnd={() => {
        const next = clampPoint(
          { x: x.get(), y: y.get() },
          { width: LAUNCHER, height: LAUNCHER },
          viewport,
        );
        x.set(next.x);
        y.set(next.y);
        setPoint(next);
        setLauncherPoint(next);
        window.setTimeout(() => {
          moved.current = false;
        }, 0);
      }}
      onDragStart={(_, info) => {
        start.current = { x: info.point.x, y: info.point.y };
        moved.current = false;
      }}
      onDrag={(_, info) => {
        const dx = Math.abs(info.point.x - start.current.x);
        const dy = Math.abs(info.point.y - start.current.y);
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          moved.current = true;
        }
      }}
      onPointerDownCapture={() => {
        moved.current = false;
      }}
    >
      <Bot aria-hidden="true" className="h-6 w-6" />
    </motion.button>
  );
}
