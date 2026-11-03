"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { AUTOMATION_WORKFLOWS, type AutomationType } from "../model";

export function AutomationWorkflow({
  type,
  stretch = false,
}: {
  type: AutomationType;
  /** Distribute steps to fill available height (detail Overview). */
  stretch?: boolean;
}) {
  const t = useTranslations("automation");
  const steps = AUTOMATION_WORKFLOWS[type];
  const rootRef = useRef<HTMLOListElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setSelectedId(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [selectedId]);

  return (
    <ol
      className={cn(
        "relative",
        // Fill the detail panel foot: distribute steps across available height.
        stretch ? "flex h-full min-h-full flex-col justify-between gap-0" : "space-y-0",
      )}
      ref={rootRef}
    >
      {/* Continuous rail — stretches full list height */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-4 bottom-4 left-[15px] w-px bg-[#e1e7f1]"
      />

      {steps.map((step, index) => {
        const selected = selectedId === step.id;
        return (
          <li
            className={cn(
              "relative flex gap-3",
              // Keep natural step height; justify-between on the list adds the stretch gaps.
              stretch && "shrink-0 py-0.5 first:pt-0 last:pb-0",
              !stretch && index < steps.length - 1 && "pb-3",
            )}
            key={step.id}
          >
            <div className="relative z-[1] flex w-8 shrink-0 justify-center pt-0.5">
              <button
                aria-pressed={selected}
                className={cn(
                  "pipeline-step-node grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold tabular-nums ring-2 ring-white",
                  step.tone === "decision" && "bg-[#fff4e6] text-[#b96d24]",
                  step.tone === "stop" && "bg-[#fff0ed] text-[#c9564f]",
                  step.tone === "action" && "bg-[#e8f7f0] text-[#238567]",
                  (!step.tone || step.tone === "default") && "bg-[#e7efff] text-[#044ce2]",
                  selected && "pipeline-step-node--selected",
                )}
                onClick={() =>
                  setSelectedId((current) => (current === step.id ? null : step.id))
                }
                type="button"
              >
                {index + 1}
              </button>
            </div>
            <div
              className={cn(
                "min-w-0 flex-1 rounded-[8px] px-1.5 py-0.5 transition-[background-color,box-shadow] duration-150",
                selected && "bg-[#eef4ff] shadow-[inset_0_0_0_1px_rgba(33,139,255,0.28)]",
              )}
            >
              <p className="text-[11px] font-semibold text-[#24334c]">{t(step.titleKey)}</p>
              <p
                className={cn(
                  "mt-0.5 text-[10px] text-[#7d8aa0]",
                  stretch ? "leading-[1.35]" : "leading-4",
                )}
              >
                {t(step.bodyKey)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
