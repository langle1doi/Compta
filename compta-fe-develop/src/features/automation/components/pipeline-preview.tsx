"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { LivePipelineStep, PipelineBadge } from "../pipeline";

const badgeClass: Record<PipelineBadge, string> = {
  scheduled: "bg-[#e7efff] text-[#044ce2]",
  automatic: "bg-[#e8f7f0] text-[#238567]",
  suggest_approve: "bg-[#f3eefe] text-[#6b4bb5]",
  needs_review: "bg-[#fff4e6] text-[#b96d24]",
  system: "bg-[#eef1f6] text-[#516078]",
};

export function PipelinePreview({
  steps,
  title,
  stretch = false,
}: {
  steps: LivePipelineStep[];
  title?: string;
  stretch?: boolean;
}) {
  const t = useTranslations("automation");
  const rootRef = useRef<HTMLElement>(null);
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
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-[12px] border border-[#edf2f8] bg-[#fbfcfe]",
        stretch ? "h-full" : "",
      )}
      ref={rootRef}
    >
      <div className="shrink-0 border-b border-[#edf2f8] px-3.5 py-3">
        <h3 className="text-[12px] font-semibold text-[#063586]">
          {title ?? t("pipeline.title")}
        </h3>
        <p className="mt-0.5 text-[10px] text-[#7d8aa0]">{t("pipeline.subtitle")}</p>
      </div>
      <ol
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto px-3.5 py-3",
          stretch ? "flex flex-col justify-between" : "space-y-0",
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-7 bottom-7 left-[29px] w-px bg-[#e1e7f1]"
        />
        {steps.map((step, index) => {
          const selected = selectedId === step.id;
          return (
            <li
              className={cn(
                "relative flex gap-3",
                stretch ? "shrink-0 py-0.5" : index < steps.length - 1 && "pb-3",
              )}
              key={step.id}
            >
              <div className="relative z-[1] flex w-8 shrink-0 justify-center pt-0.5">
                <button
                  aria-pressed={selected}
                  className={cn(
                    "pipeline-step-node grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold tabular-nums ring-2 ring-[#fbfcfe]",
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
                  "min-w-0 flex-1 rounded-[10px] border bg-white px-2.5 py-2 transition-[border-color,box-shadow] duration-150",
                  selected
                    ? "border-[#218bff] shadow-[0_0_0_1px_rgba(33,139,255,0.2)]"
                    : "border-[#edf2f8]",
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[11px] font-semibold text-[#24334c]">
                    {t(step.titleKey)}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      badgeClass[step.badge],
                    )}
                  >
                    {t(`pipeline.badge.${step.badge}`)}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-4 text-[#7d8aa0]">{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
