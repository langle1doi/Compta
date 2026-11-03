"use client";

import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import type { AssistantMessage } from "./types";

function formatSizeKb(bytes: number) {
  return Math.max(1, Math.round(bytes / 1024));
}

export function AssistantMessages({
  messages,
  busyLabel,
  busy,
  uploadProgress = 0,
  uploadingLabel,
  onSelectFollowUp,
}: {
  messages: AssistantMessage[];
  busy: boolean;
  busyLabel: string;
  uploadProgress?: number;
  uploadingLabel?: string;
  onSelectFollowUp: (prompt: string) => void;
}) {
  const t = useTranslations("assistant");
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, uploadProgress]);

  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => {
        const isUser = message.role === "user";
        const showFollowUps =
          !isUser &&
          !busy &&
          message.id === lastAssistantId &&
          Boolean(message.followUps?.length);
        const attachments = message.attachments ?? [];

        return (
          <div key={message.id} className="flex flex-col gap-2">
            <div
              className={cn("flex", isUser ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "min-w-0 max-w-[84%] whitespace-pre-wrap break-words text-[13px] leading-5",
                  isUser
                    ? "rounded-[16px_16px_4px_16px] bg-[#1764e8] px-3.5 py-2.5 text-white"
                    : "rounded-[16px_16px_16px_4px] border border-[#e3eaf4] bg-[#f5f8fc] px-3.5 py-2.5 text-[#263750]",
                  isUser && "max-w-[80%]",
                )}
              >
                <div className="flex min-w-0 flex-col gap-2">
                  {attachments.length > 0 ? (
                    <div className="flex min-w-0 flex-col gap-2">
                      {attachments.map((attachment, index) => (
                        <div
                          className="flex min-w-0 items-start gap-2.5"
                          key={`${message.id}-file-${index}-${attachment.name}`}
                        >
                          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15">
                            <FileText aria-hidden="true" className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {attachment.name}
                            </p>
                            <p
                              className={cn(
                                "mt-0.5 text-[11px]",
                                isUser ? "text-white/80" : "text-[#7d8aa0]",
                              )}
                            >
                              {t("attachment.label")} ·{" "}
                              {t("attachment.sizeKb", {
                                size: formatSizeKb(attachment.size),
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {message.content.trim() ? <p>{message.content}</p> : null}
                </div>
              </div>
            </div>

            {showFollowUps ? (
              <div className="flex max-w-[92%] flex-col gap-2 pl-0.5">
                <p className="text-[11px] font-semibold tracking-[0.02em] text-[#7d8aa0]">
                  {t("followUps.label")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {message.followUps?.map((prompt) => (
                    <button
                      className="rounded-full border border-[#d5e2f4] bg-white px-3 py-1.5 text-left text-[12px] font-semibold text-[#145be7] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#bfd6f8] hover:bg-[#f7faff]"
                      key={prompt}
                      type="button"
                      onClick={() => onSelectFollowUp(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {busy ? (
        <div className="flex justify-start">
          <div className="w-full max-w-[84%] rounded-[16px_16px_16px_4px] border border-[#e3eaf4] bg-[#f5f8fc] px-3.5 py-2.5 text-[13px] text-[#7d8aa0]">
            {uploadProgress > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span>{uploadingLabel ?? busyLabel}</span>
                  <span className="tabular-nums">{uploadProgress}%</span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-1.5 w-full overflow-hidden rounded-full bg-[#e0e8f4]"
                >
                  <div
                    className="h-full rounded-full bg-[#145be7] transition-[width] duration-100 ease-linear"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              busyLabel
            )}
          </div>
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
