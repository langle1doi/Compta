"use client";

import {
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo } from "react";

import { useMediaQuery } from "@/lib/use-media-query";

import { useAssistant } from "./assistant-provider";
import { AssistantComposer } from "./assistant-composer";
import { AssistantHeader } from "./assistant-header";
import { AssistantHistory } from "./assistant-history";
import { AssistantMessages } from "./assistant-messages";
import { AssistantWelcome } from "./assistant-welcome";
import {
  clampPoint,
  useDraggablePosition,
  useViewportSize,
} from "./hooks/use-draggable-position";

const WINDOW_W = 440;
const WINDOW_H = 660;

export function AssistantWindow() {
  const t = useTranslations("assistant");
  const {
    open,
    closeAssistant,
    messages,
    draft,
    setDraft,
    pendingFiles,
    stageFiles,
    removePendingFile,
    busy,
    uploadProgress,
    sendMessage,
    startNewConversation,
    conversations,
    activeConversationId,
    selectConversation,
    deleteConversation,
    historyOpen,
    setHistoryOpen,
    hasMessages,
    windowPoint,
    setWindowPoint,
  } = useAssistant();
  const reduceMotion = useReducedMotion();
  const isMobile = !useMediaQuery("(min-width: 768px)", true);
  const viewport = useViewportSize();
  const dragControls = useDragControls();

  const sizeFallback = useMemo(() => {
    if (isMobile) {
      return {
        width: Math.max(280, viewport.width - 16),
        height: Math.max(360, viewport.height - 16),
      };
    }
    return {
      width: Math.min(WINDOW_W, viewport.width - 24),
      height: Math.min(WINDOW_H, viewport.height - 24),
    };
  }, [isMobile, viewport.height, viewport.width]);

  const defaultFactory = useCallback(
    (vp: { width: number; height: number }) => {
      if (vp.width < 768) {
        return { x: 8, y: 8 };
      }
      return {
        x: vp.width - sizeFallback.width - 24,
        y: Math.max(8, vp.height - sizeFallback.height - 92),
      };
    },
    [sizeFallback.height, sizeFallback.width],
  );

  const { point, setPoint, dragConstraints, ready } = useDraggablePosition({
    defaultFactory,
    sizeFallback,
  });

  const activePoint = windowPoint ?? point;
  const canDragWindow = !isMobile;
  const x = useMotionValue(activePoint.x);
  const y = useMotionValue(activePoint.y);

  useEffect(() => {
    x.set(activePoint.x);
    y.set(activePoint.y);
  }, [activePoint.x, activePoint.y, x, y]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      closeAssistant();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeAssistant, open]);

  async function handleSend(raw?: string) {
    await sendMessage(raw ?? draft);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          aria-label={t("title")}
          aria-modal="false"
          className="assistant-window fixed z-[75]"
          drag={canDragWindow}
          dragConstraints={dragConstraints}
          dragControls={dragControls}
          dragElastic={0}
          dragListener={false}
          dragMomentum={false}
          initial={
            reduceMotion === true ? false : { opacity: 0, scale: 0.97 }
          }
          animate={{ opacity: ready ? 1 : 0, scale: 1 }}
          exit={
            reduceMotion === true
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.97 }
          }
          role="dialog"
          style={{
            left: 0,
            top: 0,
            x,
            y,
            width: isMobile
              ? "calc(100vw - 16px)"
              : "min(440px, calc(100vw - 24px))",
            height: isMobile
              ? "calc(100dvh - 16px)"
              : "min(680px, calc(100dvh - 24px))",
          }}
          transition={{
            duration: reduceMotion === true ? 0.01 : 0.2,
            ease: "easeOut",
          }}
          onDragEnd={() => {
            if (!canDragWindow) return;
            const next = clampPoint(
              { x: x.get(), y: y.get() },
              sizeFallback,
              viewport,
            );
            x.set(next.x);
            y.set(next.y);
            setPoint(next);
            setWindowPoint(next);
          }}
        >
          <AssistantHeader
            historyOpen={historyOpen}
            onClose={closeAssistant}
            onNewConversation={startNewConversation}
            onToggleHistory={() => setHistoryOpen((value) => !value)}
            onPointerDownHandle={
              canDragWindow
                ? (event) => {
                    dragControls.start(event);
                  }
                : undefined
            }
          />

          {historyOpen ? (
            <AssistantHistory
              activeId={activeConversationId}
              conversations={conversations}
              onDelete={deleteConversation}
              onNew={startNewConversation}
              onSelect={selectConversation}
            />
          ) : (
            <>
              <div className="assistant-body">
                {hasMessages ? (
                  <AssistantMessages
                    busy={busy}
                    busyLabel={t("busy")}
                    messages={messages}
                    uploadProgress={uploadProgress}
                    uploadingLabel={t("composer.uploading")}
                    onSelectFollowUp={(prompt) => {
                      void handleSend(prompt);
                    }}
                  />
                ) : (
                  <AssistantWelcome
                    onSelectSuggestion={(prompt) => {
                      void handleSend(prompt);
                    }}
                  />
                )}
              </div>

              <AssistantComposer
                autoFocus={open && !historyOpen}
                disabled={busy}
                pendingFiles={pendingFiles}
                uploadProgress={uploadProgress}
                uploading={busy && uploadProgress > 0}
                value={draft}
                onChange={setDraft}
                onRemoveFile={removePendingFile}
                onSend={() => {
                  void handleSend();
                }}
                onStageFiles={stageFiles}
              />
            </>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
