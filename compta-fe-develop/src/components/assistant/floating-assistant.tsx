"use client";

import { useCan } from "@/features/settings/can";

import { AssistantLauncher } from "./assistant-launcher";
import { useAssistant } from "./assistant-provider";
import { AssistantWindow } from "./assistant-window";

/** Global COMPTA Assistant chrome — requires AssistantProvider in AppShell. */
export function FloatingAssistant() {
  const { open } = useAssistant();
  const check = useCan();

  if (!check("ai.use")) return null;

  return (
    <>
      {!open ? <AssistantLauncher /> : null}
      <AssistantWindow />
    </>
  );
}
