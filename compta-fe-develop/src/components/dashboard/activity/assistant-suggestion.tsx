import { Sparkles } from "lucide-react";

export function AssistantSuggestion({
  title,
  countLabel,
  suggestionTitle,
  body,
  primaryLabel,
  secondaryLabel,
  preparing,
  onPrimary,
  onSecondary,
}: {
  title: string;
  countLabel: string;
  suggestionTitle: string;
  body: string;
  primaryLabel: string;
  secondaryLabel: string;
  preparing: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <section aria-busy={preparing} className="activity-desk__assistant px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[11px] bg-[#e7efff] text-[#044ce2]">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-[#063586]">{title}</h3>
        </div>
        <p className="shrink-0 text-xs text-[#66758d] tabular-nums">{countLabel}</p>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#063586]">{suggestionTitle}</p>
      <p className="mt-1 text-sm leading-5 text-[#405069] tabular-nums">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="action-motion inline-flex min-h-10 flex-1 items-center justify-center rounded-[10px] bg-[#044ce2] px-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(4_76_226/0.22)] hover:bg-[#063586] disabled:cursor-progress disabled:opacity-80"
          disabled={preparing}
          type="button"
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
        <button
          className="action-motion inline-flex min-h-10 flex-1 items-center justify-center rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm font-semibold text-[#405069] shadow-[0_1px_2px_rgb(20_32_51/0.04)] hover:border-[#b9d0fb]"
          type="button"
          onClick={onSecondary}
        >
          {secondaryLabel}
        </button>
      </div>
    </section>
  );
}
