"use client";

import dynamic from "next/dynamic";

import type { TemplateRecord } from "../model";
import { isDocumentUseCase } from "../utils";

const previewFallback = (
  <div className="flex min-h-0 flex-1 flex-col gap-3 p-1">
    <div className="loading-shimmer h-10 w-full rounded-[10px]" />
    <div className="loading-shimmer min-h-[280px] flex-1 rounded-[12px]" />
  </div>
);

const DocumentTemplateWorkspace = dynamic(
  () =>
    import("../document/DocumentTemplateWorkspace").then(
      (mod) => mod.DocumentTemplateWorkspace,
    ),
  { loading: () => previewFallback },
);

const EmailTemplateWorkspace = dynamic(
  () =>
    import("../email/EmailTemplateWorkspace").then(
      (mod) => mod.EmailTemplateWorkspace,
    ),
  { loading: () => previewFallback },
);

export function TemplatePreviewPanel({
  template,
  canManage,
  editing = false,
  onEditingChange,
  onClose,
  onDuplicate,
  onSetDefault,
  onSaved,
}: {
  template: TemplateRecord;
  canManage: boolean;
  editing?: boolean;
  onEditingChange: (editing: boolean) => void;
  onClose?: () => void;
  onEdit?: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onSaved?: () => void;
}) {
  const isDocument =
    template.type === "document" && isDocumentUseCase(template.useCase);
  const isEmail = template.type === "email" && Boolean(template.emailConfig);
  const remountKey = `${template.id}-${editing ? "edit" : "view"}`;

  if (isEmail) {
    return (
      <EmailTemplateWorkspace
        key={remountKey}
        canManage={canManage}
        editing={editing}
        template={template}
        onClose={onClose}
        onDuplicate={onDuplicate}
        onEditingChange={onEditingChange}
        onSaved={onSaved}
        onSetDefault={onSetDefault}
      />
    );
  }

  if (isDocument) {
    return (
      <DocumentTemplateWorkspace
        key={remountKey}
        canManage={canManage}
        editing={editing}
        template={template}
        onClose={onClose}
        onDuplicate={onDuplicate}
        onEditingChange={onEditingChange}
        onSaved={onSaved}
        onSetDefault={onSetDefault}
      />
    );
  }

  return null;
}
