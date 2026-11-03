"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function CustomerHistoryEmpty({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto mt-10 flex w-full max-w-[300px] flex-col items-center px-3 text-center sm:mt-12",
        className,
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#eef3fa] text-[#044ce2]">
        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="mt-3 text-sm font-semibold text-[#24334c]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#7d8aa0]">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
