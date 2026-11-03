"use client";

import { cn } from "@/lib/utils";

import { EmailPreview } from "../email-preview/EmailPreview";
import { emailDemoValues } from "../email/demo-values";
import { labelForUseCase } from "../labels";
import type { TemplateRecord } from "../model";
import { substituteVariables } from "../variables";
import { isDocumentUseCase } from "../utils";

/** Catalog mini preview — floating paper on grey stage (documents + emails). */
export function TemplateCardThumbnail({
  template,
}: {
  template: TemplateRecord;
}) {
  const isDocument =
    template.type === "document" && isDocumentUseCase(template.useCase);
  const accent =
    template.documentConfig?.primaryColor ??
    (isDocument ? "#2458d6" : "#063586");

  if (!isDocument && template.emailConfig) {
    return (
      <div className="relative flex h-full items-center justify-center bg-[#f3f4f6] p-3">
        <EmailPreview
          accentColor={accent}
          companyName={template.companyName}
          compact
          config={template.emailConfig}
          headerLabel={labelForUseCase(template.useCase)}
          language={template.language}
          useCase={template.useCase}
        />
      </div>
    );
  }

  const values = emailDemoValues(template.useCase, template.companyName);
  const docTitle = template.name;
  const customer = substituteVariables("{{customer.name}}", values);
  const amount = substituteVariables(
    template.useCase === "quote" ? "{{quote.total}}" : "{{invoice.total}}",
    values,
  );

  return (
    <div className="relative flex h-full items-center justify-center bg-[#f3f4f6] p-3">
      <div
        aria-hidden="true"
        className="relative flex h-[124px] w-[92px] flex-col overflow-hidden rounded-[5px] border border-[#e5e7eb] bg-white shadow-[0_8px_18px_rgba(31,41,55,0.12)]"
      >
        <div
          className="flex h-7 shrink-0 items-center px-2"
          style={{ backgroundColor: accent }}
        >
          <span className="truncate text-[8px] font-bold tracking-[0.04em] text-white uppercase">
            {labelForUseCase(template.useCase)}
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
          <p className="truncate text-[9px] font-bold text-[#173156]">
            {docTitle}
          </p>
          <p className="truncate text-[8px] font-medium text-[#405069]">
            {template.companyName}
          </p>
          <p className="truncate text-[8px] text-[#66758d]">{customer}</p>
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
          <p
            className={cn(
              "mt-auto truncate text-right text-[9px] font-bold tabular-nums",
            )}
            style={{ color: accent }}
          >
            {amount}
          </p>
        </div>
      </div>
    </div>
  );
}
