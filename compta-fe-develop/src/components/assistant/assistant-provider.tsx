"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";

import {
  useAssistantChat,
  type PendingAssistantFile,
} from "./hooks/use-assistant-chat";
import type { AssistantConversation, AssistantMessage, Point } from "./types";

type AssistantApi = {
  open: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  messages: AssistantMessage[];
  conversations: AssistantConversation[];
  activeConversationId: string;
  draft: string;
  setDraft: (value: string) => void;
  pendingFiles: PendingAssistantFile[];
  stageFiles: (files: File[]) => void;
  removePendingFile: (id: string) => void;
  busy: boolean;
  uploadProgress: number;
  historyOpen: boolean;
  setHistoryOpen: Dispatch<SetStateAction<boolean>>;
  sendMessage: (raw: string) => Promise<void>;
  startNewConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearConversation: () => void;
  hasMessages: boolean;
  launcherRef: RefObject<HTMLButtonElement | null>;
  launcherPoint: Point | null;
  setLauncherPoint: (point: Point | null) => void;
  windowPoint: Point | null;
  setWindowPoint: (point: Point | null) => void;
};

const AssistantContext = createContext<AssistantApi | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const chat = useAssistantChat();
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [launcherPoint, setLauncherPoint] = useState<Point | null>(null);
  const [windowPoint, setWindowPoint] = useState<Point | null>(null);

  const openAssistant = useCallback(() => {
    openRef.current = true;
    setOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    window.requestAnimationFrame(() => {
      launcherRef.current?.focus();
    });
  }, []);

  const toggleAssistant = useCallback(() => {
    if (openRef.current) closeAssistant();
    else openAssistant();
  }, [closeAssistant, openAssistant]);

  const value = useMemo(
    () => ({
      open,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      messages: chat.messages,
      conversations: chat.conversations,
      activeConversationId: chat.activeConversationId,
      draft: chat.draft,
      setDraft: chat.setDraft,
      pendingFiles: chat.pendingFiles,
      stageFiles: chat.stageFiles,
      removePendingFile: chat.removePendingFile,
      busy: chat.busy,
      uploadProgress: chat.uploadProgress,
      historyOpen: chat.historyOpen,
      setHistoryOpen: chat.setHistoryOpen,
      sendMessage: chat.sendMessage,
      startNewConversation: chat.startNewConversation,
      selectConversation: chat.selectConversation,
      deleteConversation: chat.deleteConversation,
      clearConversation: chat.clearConversation,
      hasMessages: chat.hasMessages,
      launcherRef,
      launcherPoint,
      setLauncherPoint,
      windowPoint,
      setWindowPoint,
    }),
    [
      open,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      chat.messages,
      chat.conversations,
      chat.activeConversationId,
      chat.draft,
      chat.setDraft,
      chat.pendingFiles,
      chat.stageFiles,
      chat.removePendingFile,
      chat.busy,
      chat.uploadProgress,
      chat.historyOpen,
      chat.setHistoryOpen,
      chat.sendMessage,
      chat.startNewConversation,
      chat.selectConversation,
      chat.deleteConversation,
      chat.clearConversation,
      chat.hasMessages,
      launcherPoint,
      windowPoint,
    ],
  );

  return (
    <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error("useAssistant must be used inside AssistantProvider");
  }
  return context;
}

export function useAssistantOptional() {
  return useContext(AssistantContext);
}
