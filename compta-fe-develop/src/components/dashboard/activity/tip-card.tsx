import { ArrowRight } from "lucide-react";

export function TipCard({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="activity-desk__tip border-t border-[#edf1f6] px-4 py-4">
      <h3 className="text-sm font-semibold tracking-[-0.01em] text-[#405069]">{title}</h3>
      <p className="mt-2 text-sm leading-5 text-[#66758d]">{body}</p>
      <button className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#044ce2]" type="button" onClick={onAction}>
        {actionLabel}
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}
