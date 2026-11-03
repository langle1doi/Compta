"use client";

import { FileText, Paperclip, SendHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useRef,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

import type { PendingAssistantFile } from "./hooks/use-assistant-chat";

/** Common office / mail formats + broad fallback for “other” types. */
export const ASSISTANT_FILE_ACCEPT = [
  ".eml",
  ".msg",
  ".xls",
  ".xlsx",
  ".csv",
  ".doc",
  ".docx",
  ".pdf",
  ".txt",
  ".rtf",
  ".odt",
  ".ods",
  ".ppt",
  ".pptx",
  ".json",
  ".xml",
  ".zip",
  "image/*",
  "text/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

function formatSizeKb(bytes: number) {
  return Math.max(1, Math.round(bytes / 1024));
}

export function AssistantComposer({
  value,
  pendingFiles,
  disabled,
  uploading,
  uploadProgress,
  autoFocus,
  onChange,
  onSend,
  onStageFiles,
  onRemoveFile,
}: {
  value: string;
  pendingFiles: PendingAssistantFile[];
  disabled?: boolean;
  uploading?: boolean;
  uploadProgress?: number;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onStageFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
}) {
  const t = useTranslations("assistant");
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const node = areaRef.current;
    if (!node) return;
    node.style.height = "0px";
    const next = Math.min(node.scrollHeight, 120);
    node.style.height = `${Math.max(24, next)}px`;
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    areaRef.current?.focus();
  }, [autoFocus]);

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (disabled) return;
    if (!value.trim() && pendingFiles.length === 0) return;
    onSend();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (!files.length || disabled) return;
    onStageFiles(files);
  }

  const canSend =
    !disabled && (Boolean(value.trim()) || pendingFiles.length > 0);
  const progress = Math.max(0, Math.min(100, uploadProgress ?? 0));

  return (
    <form className="assistant-composer-wrap shrink-0" onSubmit={handleSubmit}>
      {uploading ? (
        <div className="mb-2 px-0.5">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#5b6b86]">
            <span>{t("composer.uploading")}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div
            aria-hidden="true"
            className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8eef8]"
          >
            <div
              className="h-full rounded-full bg-[#145be7] transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {pendingFiles.length > 0 ? (
        <div className="mb-2 flex max-h-[96px] flex-wrap gap-1.5 overflow-y-auto px-0.5">
          {pendingFiles.map((item) => (
            <div
              className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-[#d5e2f4] bg-[#f7faff] py-1 pl-1.5 pr-1 text-[#063586] sm:max-w-[220px]"
              key={item.id}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white">
                <FileText aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                {item.file.name}
              </span>
              <span className="hidden shrink-0 text-[10px] text-[#7d8aa0] sm:inline">
                {t("attachment.sizeKb", {
                  size: formatSizeKb(item.file.size),
                })}
              </span>
              <button
                aria-label={t("composer.removeFile", { name: item.file.name })}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#5b6b86] transition-colors hover:bg-[#e8eef8] hover:text-[#063586] disabled:opacity-40"
                disabled={disabled}
                type="button"
                onClick={() => onRemoveFile(item.id)}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="assistant-composer flex items-end gap-1.5">
        <input
          accept={ASSISTANT_FILE_ACCEPT}
          className="sr-only"
          multiple
          ref={fileRef}
          type="file"
          onChange={handleFileChange}
        />
        <button
          aria-label={t("composer.attach")}
          className="grid h-10 w-10 shrink-0 place-items-center bg-transparent text-[#063586] transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
          title={t("composer.attachHint")}
          type="button"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <label className="sr-only" htmlFor="compte-assistant-input">
          {t("composer.label")}
        </label>
        <textarea
          className="max-h-[120px] min-h-[24px] min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-[13px] leading-5 text-[#24334c] outline-none placeholder:text-[#9aa8bc] sm:px-2"
          disabled={disabled}
          id="compte-assistant-input"
          placeholder={t("composer.placeholder")}
          ref={areaRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          aria-label={t("composer.send")}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] transition-colors",
            canSend
              ? "bg-[#145be7] text-white hover:bg-[#114fc9]"
              : "bg-[#e8eef8] text-[#9aa8bc]",
          )}
          disabled={!canSend}
          type="submit"
        >
          <SendHorizontal aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
