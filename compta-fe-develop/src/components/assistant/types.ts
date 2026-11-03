export type AssistantRole = "user" | "assistant";

export type AssistantAttachment = {
  name: string;
  size: number;
  type: string;
};

export type AssistantMessage = {
  id: string;
  role: AssistantRole;
  content: string;
  createdAt: number;
  /** Clickable next questions (assistant messages only). */
  followUps?: string[];
  /** Mock file metadata shown on user upload messages. */
  attachments?: AssistantAttachment[];
};

export type AssistantConversation = {
  id: string;
  /** First user message, or null while empty. */
  title: string | null;
  messages: AssistantMessage[];
  createdAt: number;
  updatedAt: number;
};

export type Point = { x: number; y: number };

export type AssistantSuggestionId =
  | "overdueInvoices"
  | "quotePipeline"
  | "customersOwe"
  | "whatChanged";

/** Future context hook — not wired to AI yet. */
export type AssistantContext = {
  route?: string;
  companyId?: string;
  entityType?: string;
  entityId?: string;
};
