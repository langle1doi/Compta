"use client";

import { cn } from "@/lib/utils";

import { emailDemoValues } from "../email/demo-values";
import type { EmailTemplateConfig } from "../model";
import { substituteVariables } from "../variables";

export type EmailPreviewProps = {
  config: EmailTemplateConfig;
  companyName: string;
  language: string;
  useCase: string;
  /** Header label on the mini paper (e.g. use-case name). */
  headerLabel?: string;
  accentColor?: string;
  compact?: boolean;
  className?: string;
};

/**
 * Catalog-card email thumbnail — same floating mini-paper language as Quote cards.
 */
export function EmailPreview({
  config,
  companyName,
  useCase,
  headerLabel = "Email",
  accentColor = "#063586",
  className,
}: EmailPreviewProps) {
  const values = emailDemoValues(useCase, companyName);
  const subject = substituteVariables(config.subject, values);
  const body = substituteVariables(config.body, values);
  const customer = values["customer.name"];
  const previewLine = body
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex h-[124px] w-[92px] flex-col overflow-hidden rounded-[5px] border border-[#e5e7eb] bg-white shadow-[0_8px_18px_rgba(31,41,55,0.12)]",
        className,
      )}
    >
      <div
        className="flex h-7 shrink-0 items-center px-2"
        style={{ backgroundColor: accentColor }}
      >
        <span className="truncate text-[8px] font-bold tracking-[0.04em] text-white uppercase">
          {headerLabel}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
        <p className="line-clamp-2 text-[8px] font-bold leading-tight text-[#173156]">
          {subject}
        </p>
        <p className="truncate text-[7px] font-medium text-[#405069]">
          {companyName}
        </p>
        <p className="truncate text-[7px] text-[#66758d]">{customer}</p>
        <div className="mt-0.5 space-y-1 border-t border-[#e8eef7] pt-1.5">
          <div className="flex items-center justify-between gap-1">
            <span className="h-1.5 w-8 rounded-sm bg-[#c5d4ea]" />
            <span className="h-1.5 w-5 rounded-sm bg-[#d7e2f2]" />
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="h-1.5 w-10 rounded-sm bg-[#c5d4ea]" />
            <span className="h-1.5 w-6 rounded-sm bg-[#d7e2f2]" />
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="h-1.5 w-7 rounded-sm bg-[#c5d4ea]" />
            <span className="h-1.5 w-5 rounded-sm bg-[#d7e2f2]" />
          </div>
        </div>
        {previewLine ? (
          <p className="mt-auto line-clamp-2 text-[7px] leading-tight text-[#66758d]">
            {previewLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}
