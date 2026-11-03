import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function enterStyle(order: number): CSSProperties {
  return { animationDelay: `${30 + order * 30}ms` };
}

export function CardHeader({
  title,
  titleId,
  meta,
  action,
  actionHref,
  actionAriaLabel,
  onActionClick,
  children,
}: {
  title: string;
  titleId?: string;
  meta?: ReactNode;
  action?: string;
  actionHref?: string;
  actionAriaLabel?: string;
  onActionClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-5 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="dashboard-card-title truncate" id={titleId}>
          {title}
        </h2>
        {meta}
      </div>
      {children}
      {action ? (
        actionHref ? (
          <a className="dashboard-link inline-flex items-center gap-0.5 text-[11px]" href={actionHref}>
            {action}
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
          </a>
        ) : (
          <button
            aria-label={actionAriaLabel}
            className="dashboard-link inline-flex items-center gap-0.5 text-[11px]"
            type="button"
            onClick={onActionClick}
          >
            {action}
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
          </button>
        )
      ) : null}
    </div>
  );
}

export function DemoTag({ label, hint }: { label: string; hint: string }) {
  return (
    <span
      className="inline-flex h-4 shrink-0 items-center rounded-full bg-[#edf2f7] px-1.5 text-[9px] font-semibold text-[#65758d]"
      title={hint}
    >
      {label}
    </span>
  );
}

export function LegendDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="h-2 w-2 shrink-0 rounded-[2px]"
      style={{ backgroundColor: color }}
    />
  );
}
