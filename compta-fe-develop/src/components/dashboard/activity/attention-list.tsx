import type { AttentionItem } from "@/features/activity/model";

import { AttentionItemRow } from "./attention-item";

export function AttentionList({
  title,
  countLabel,
  items,
  caughtTitle,
  caughtBody,
  onOpen,
}: {
  title: string;
  countLabel: string;
  items: AttentionItem[];
  caughtTitle: string;
  caughtBody: string;
  onOpen: (item: AttentionItem) => void;
}) {
  return (
    <section className="activity-desk__attention border-t border-[#edf1f6] px-0 py-4">
      <div className="flex items-baseline justify-between gap-3 px-4">
        <h3 className="text-sm font-semibold tracking-[-0.01em] text-[#063586]">{title}</h3>
        {items.length > 0 ? <p className="text-xs text-[#66758d] tabular-nums">{countLabel}</p> : null}
      </div>
      {items.length === 0 ? (
        <div className="px-4 pt-3">
          <p className="text-sm font-semibold text-[#063586]">{caughtTitle}</p>
          <p className="mt-1 text-sm leading-5 text-[#66758d]">{caughtBody}</p>
        </div>
      ) : (
        <div className="mt-2">
          {items.map((item) => (
            <AttentionItemRow item={item} key={item.id} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}
