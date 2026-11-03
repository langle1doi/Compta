"use client";

import { AlertTriangle, Check, Loader2, Minus, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import { useOutsideDismiss } from "@/lib/use-outside-dismiss";
import { cn } from "@/lib/utils";

import type { RunStageNode, RunStageState } from "../run-stages";

const stateClass: Record<RunStageState, string> = {
  done: "border-[#1f8f57] bg-[#1f8f57] text-white",
  warning: "border-[#d97706] bg-[#d97706] text-white",
  failed: "border-[#c9564f] bg-[#c9564f] text-white",
  skipped: "border-[#c5d0e0] bg-[#eef1f6] text-[#7d8aa0]",
  pending: "border-[#d7deea] bg-white text-transparent",
  running: "border-[#044ce2] bg-[#e8efff] text-[#044ce2]",
};

const lineClass: Record<RunStageState, string> = {
  done: "bg-[#1f8f57]",
  warning: "bg-[#f0c57a]",
  failed: "bg-[#e2a39e]",
  skipped: "bg-[#d7deea]",
  pending: "bg-[#e4ebf5]",
  running: "bg-[#c9d9ff]",
};

function StageIcon({ state }: { state: RunStageState }) {
  if (state === "done") {
    return <Check aria-hidden="true" className="h-2.5 w-2.5" strokeWidth={3} />;
  }
  if (state === "warning") {
    return <AlertTriangle aria-hidden="true" className="h-2.5 w-2.5" strokeWidth={2.5} />;
  }
  if (state === "failed") {
    return <X aria-hidden="true" className="h-2.5 w-2.5" strokeWidth={3} />;
  }
  if (state === "skipped") {
    return <Minus aria-hidden="true" className="h-2.5 w-2.5" strokeWidth={3} />;
  }
  if (state === "running") {
    return <Loader2 aria-hidden="true" className="h-2.5 w-2.5 animate-spin" />;
  }
  return <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#d7deea]" />;
}

type PopoverBox = {
  top: number;
  left: number;
  caretLeft: number;
  placement: "below" | "above";
};

export function RunStagesRail({
  nodes,
  className,
}: {
  nodes: RunStageNode[];
  className?: string;
}) {
  const t = useTranslations("automation");
  const rootRef = useRef<HTMLOListElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [box, setBox] = useState<PopoverBox | null>(null);

  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  function dismiss() {
    setSelectedId(null);
    setBox(null);
  }

  useOutsideDismiss({
    active: selectedId !== null,
    onDismiss: dismiss,
    roots: [rootRef, popoverRef],
  });

  useLayoutEffect(() => {
    if (!selectedId) return;
    const activeId = selectedId;

    function updatePosition() {
      const trigger = buttonRefs.current.get(activeId);
      const popover = popoverRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const popoverWidth = popover?.offsetWidth ?? 220;
      const popoverHeight = popover?.offsetHeight ?? 96;
      const gap = 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placement =
        spaceBelow < popoverHeight + gap + 8 && rect.top > popoverHeight + gap
          ? "above"
          : "below";

      const rawLeft = rect.left + rect.width / 2 - popoverWidth / 2;
      const left = Math.min(
        Math.max(8, rawLeft),
        window.innerWidth - popoverWidth - 8,
      );
      const top =
        placement === "below"
          ? rect.bottom + gap
          : Math.max(8, rect.top - gap - popoverHeight);
      const caretLeft = rect.left + rect.width / 2 - left;

      setBox({ top, left, caretLeft, placement });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [selectedId, selected?.bodyKey]);

  return (
    <>
      <ol
        aria-label={t("runs.columns.stages")}
        className={cn("flex min-w-0 max-w-full items-center", className)}
        ref={rootRef}
      >
        {nodes.map((node, index) => {
          const label = t(node.titleKey);
          const stateLabel = t(`runStages.${node.state}`);
          const isSelected = selectedId === node.id;
          return (
            <li className="flex min-w-0 items-center" key={node.id}>
              <button
                aria-expanded={isSelected}
                aria-label={`${label}: ${stateLabel}`}
                aria-pressed={isSelected}
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-[box-shadow,transform] duration-150",
                  stateClass[node.state],
                  isSelected && "run-stage-node--selected scale-110",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  if (selectedId === node.id) {
                    dismiss();
                    return;
                  }
                  setSelectedId(node.id);
                }}
                ref={(element) => {
                  if (element) buttonRefs.current.set(node.id, element);
                  else buttonRefs.current.delete(node.id);
                }}
                type="button"
              >
                <StageIcon state={node.state} />
              </button>
              {index < nodes.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-0.5 h-px w-1.5 shrink-0 sm:mx-1 sm:w-2.5",
                    lineClass[node.state === "pending" ? "pending" : node.state],
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {typeof document !== "undefined" && selected
        ? createPortal(
            <div
              className="fixed z-[90] w-[min(240px,calc(100vw-16px))] rounded-[10px] border border-[#e1e7f1] bg-white px-3 py-2.5 shadow-[0_12px_28px_rgba(29,43,68,0.16)]"
              ref={popoverRef}
              role="dialog"
              style={
                box
                  ? { top: box.top, left: box.left }
                  : { top: -9999, left: -9999, visibility: "hidden" }
              }
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute h-2 w-2 -translate-x-1/2 rotate-45 border border-[#e1e7f1] bg-white",
                  box?.placement === "above"
                    ? "bottom-[-5px] border-t-0 border-l-0"
                    : "top-[-5px] border-b-0 border-r-0",
                )}
                style={{ left: box ? `${box.caretLeft}px` : "50%" }}
              />
              <p className="relative text-[11px] font-semibold text-[#24334c]">
                {t("runStages.stageLabel", { stage: t(selected.titleKey) })}
              </p>
              <div className="relative mt-1.5 flex items-start gap-1.5 border-t border-[#edf2f8] pt-1.5">
                <span
                  className={cn(
                    "mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border",
                    stateClass[selected.state],
                  )}
                >
                  <StageIcon state={selected.state} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#516078]">
                    {t(`runStages.${selected.state}`)}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-4 text-[#7d8aa0]">
                    {t(selected.bodyKey)}
                  </p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
