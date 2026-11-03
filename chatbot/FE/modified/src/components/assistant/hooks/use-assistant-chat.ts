"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api/client";

import type {
  AssistantAttachment,
  AssistantConversation,
  AssistantMessage,
} from "../types";

export type PendingAssistantFile = {
  id: string;
  file: File;
};

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromMessages(messages: AssistantMessage[]) {
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser) return null;
  const text = firstUser.content.trim();
  if (text.length <= 48) return text;
  return `${text.slice(0, 45)}…`;
}

function createEmptyConversation(): AssistantConversation {
  const now = Date.now();
  return {
    id: createId("conv"),
    title: null,
    messages: [],
    updatedAt: now,
    createdAt: now,
  };
}

function toAttachments(files: File[]): AssistantAttachment[] {
  return files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  }));
}

function buildAttachmentReply(
  attachments: AssistantAttachment[],
  isFr: boolean,
) {
  const count = attachments.length;
  const fileLines = attachments.flatMap((file, index) => {
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    if (isFr) {
      return [
        `${index + 1}. ${file.name}`,
        `   • Taille : ${sizeKb} Ko`,
        `   • Type : ${file.type || "inconnu"}`,
      ];
    }
    return [
      `${index + 1}. ${file.name}`,
      `   • Size: ${sizeKb} KB`,
      `   • Type: ${file.type || "unknown"}`,
    ];
  });

  return isFr
    ? [
        count === 1
          ? "Fichier reçu (démo)."
          : `${count} fichiers reçus (démo).`,
        "",
        ...fileLines,
        "",
        "Aucun traitement réel n’a été lancé — confirmation mock pour tester l’UI.",
      ].join("\n")
    : [
        count === 1
          ? "File received (demo)."
          : `${count} files received (demo).`,
        "",
        ...fileLines,
        "",
        "No real processing ran — mock confirmation for UI testing only.",
      ].join("\n");
}

const FOLLOW_UPS_FR = [
  "Quelles factures sont en retard ?",
  "Résume mon pipeline de devis",
  "Qu’est-ce qui a changé aujourd’hui ?",
];

const FOLLOW_UPS_EN = [
  "Which invoices are overdue?",
  "Summarize my quote pipeline",
  "What changed today?",
];

export function useAssistantChat() {
  const locale = useLocale();
  const [conversations, setConversations] = useState<AssistantConversation[]>(
    () => [createEmptyConversation()],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingAssistantFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const progressTimerRef = useRef<number | null>(null);

  const resolvedActiveId = activeId ?? conversations[0]?.id ?? "";
  const active =
    conversations.find((item) => item.id === resolvedActiveId) ??
    conversations[0];
  const messages = active?.messages ?? [];

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current != null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearProgressTimer(), [clearProgressTimer]);

  const runMockUploadProgress = useCallback(
    (durationMs: number) => {
      clearProgressTimer();
      setUploadProgress(4);
      const startedAt = Date.now();
      progressTimerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const next = Math.min(96, Math.round((elapsed / durationMs) * 100));
        setUploadProgress(next);
        if (elapsed >= durationMs) clearProgressTimer();
      }, 80);
    },
    [clearProgressTimer],
  );

  const patchActive = useCallback(
    (updater: (current: AssistantConversation) => AssistantConversation) => {
      setConversations((list) => {
        const currentId = activeId ?? list[0]?.id;
        return list.map((item) =>
          item.id === currentId ? updater(item) : item,
        );
      });
    },
    [activeId],
  );

  const resetComposer = useCallback(() => {
    setDraft("");
    setPendingFiles([]);
    setUploadProgress(0);
    clearProgressTimer();
  }, [clearProgressTimer]);

  const startNewConversation = useCallback(() => {
    setBusy(false);
    resetComposer();
    setHistoryOpen(false);
    const next = createEmptyConversation();
    setConversations((list) => {
      const currentId = activeId ?? list[0]?.id;
      const current = list.find((item) => item.id === currentId);
      const kept = list.filter((item) => {
        if (item.id !== currentId) return true;
        return (current?.messages.length ?? 0) > 0;
      });
      return [next, ...kept];
    });
    setActiveId(next.id);
  }, [activeId, resetComposer]);

  const selectConversation = useCallback(
    (id: string) => {
      setActiveId(id);
      resetComposer();
      setBusy(false);
      setHistoryOpen(false);
    },
    [resetComposer],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((list) => {
        const next = list.filter((item) => item.id !== id);
        if (next.length === 0) {
          const fresh = createEmptyConversation();
          setActiveId(fresh.id);
          return [fresh];
        }
        const currentId = activeId ?? list[0]?.id;
        if (id === currentId) {
          setActiveId(next[0].id);
        }
        return next;
      });
      resetComposer();
      setBusy(false);
    },
    [activeId, resetComposer],
  );

  const stageFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    setPendingFiles((current) => {
      const next = files.map((file) => ({
        id: createId("file"),
        file,
      }));
      return [...current, ...next];
    });
  }, []);

  const removePendingFile = useCallback((id: string) => {
    setPendingFiles((current) => current.filter((item) => item.id !== id));
  }, []);

  const sendMessage = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      const files = pendingFiles.map((item) => item.file);
      const hasFiles = files.length > 0;
      if (!content && !hasFiles) return;

      const isFr = locale.toLowerCase().startsWith("fr");
      const attachments = hasFiles ? toAttachments(files) : undefined;
      const titleSeed =
        content ||
        (isFr
          ? attachments!.length === 1
            ? `Fichier joint : ${attachments![0].name}`
            : `${attachments!.length} fichiers joints`
          : attachments!.length === 1
            ? `Attached file: ${attachments![0].name}`
            : `${attachments!.length} attached files`);

      const userMessage: AssistantMessage = {
        id: createId("msg"),
        role: "user",
        content,
        createdAt: Date.now(),
        attachments,
      };

      patchActive((current) => ({
        ...current,
        title:
          current.title ??
          titleFromMessages([{ ...userMessage, content: titleSeed }]),
        messages: [...current.messages, userMessage],
        updatedAt: Date.now(),
      }));
      resetComposer();
      setBusy(true);
      setHistoryOpen(false);

      // Files stay mocked: the backend has no upload endpoint for the assistant yet.
      let reply = "";
      if (hasFiles) {
        runMockUploadProgress(4000);
        await new Promise((resolve) => window.setTimeout(resolve, 4000));
        setUploadProgress(100);
      } else {
        try {
          const history = [...messages, userMessage].map(
            ({ role, content: text }) => ({ role, content: text }),
          );
          const result = await apiFetch<{ reply: string }>("/assistant/chat", {
            method: "POST",
            body: { messages: history, locale: isFr ? "fr" : "en" },
          });
          reply = result.reply;
        } catch {
          reply = isFr
            ? "Désolé, l’assistant est indisponible pour le moment. Réessayez dans quelques instants."
            : "Sorry, the assistant is unavailable right now. Please try again shortly.";
        }
      }

      clearProgressTimer();

      const assistantMessage: AssistantMessage = hasFiles
        ? {
            id: createId("msg"),
            role: "assistant",
            content: [
              content
                ? isFr
                  ? `Message reçu : « ${content} »`
                  : `Message received: “${content}”`
                : null,
              buildAttachmentReply(attachments!, isFr),
            ]
              .filter(Boolean)
              .join("\n\n"),
            followUps: isFr ? FOLLOW_UPS_FR : FOLLOW_UPS_EN,
            createdAt: Date.now(),
          }
        : {
            id: createId("msg"),
            role: "assistant",
            content: reply,
            followUps: isFr ? FOLLOW_UPS_FR : FOLLOW_UPS_EN,
            createdAt: Date.now(),
          };

      patchActive((current) => ({
        ...current,
        messages: [...current.messages, assistantMessage],
        updatedAt: Date.now(),
      }));
      setBusy(false);
      setUploadProgress(0);
    },
    [
      clearProgressTimer,
      locale,
      messages,
      patchActive,
      pendingFiles,
      resetComposer,
      runMockUploadProgress,
    ],
  );

  return {
    conversations,
    activeConversationId: active?.id ?? resolvedActiveId,
    messages,
    draft,
    setDraft,
    pendingFiles,
    stageFiles,
    removePendingFile,
    busy,
    uploadProgress,
    historyOpen,
    setHistoryOpen,
    sendMessage,
    startNewConversation,
    selectConversation,
    deleteConversation,
    clearConversation: startNewConversation,
    hasMessages: messages.length > 0,
  };
}
