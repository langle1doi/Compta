"use client";

import { useSyncExternalStore } from "react";

import type {
  DocumentTemplateConfig,
  EmailTemplateConfig,
  TemplateLanguage,
  TemplateRecord,
  TemplateStatus,
  TemplateType,
  TemplateUseCase,
} from "./model";
import {
  defaultDocumentConfig,
  defaultEmailConfig,
} from "./model";
import { seedTemplates } from "./seed";
import { defaultScopeKey, isDocumentUseCase } from "./utils";

type State = {
  templates: TemplateRecord[];
};

let state: State = {
  templates: seedTemplates,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useTemplatesState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function clearDefaultInScope(
  templates: TemplateRecord[],
  companyId: string,
  useCase: TemplateUseCase,
  language: TemplateLanguage,
  exceptId?: string,
) {
  const key = defaultScopeKey(companyId, useCase, language);
  return templates.map((item) => {
    if (exceptId && item.id === exceptId) return item;
    const itemKey = defaultScopeKey(item.companyId, item.useCase, item.language);
    if (itemKey === key && item.isDefault) {
      return { ...item, isDefault: false, updatedAt: new Date().toISOString() };
    }
    return item;
  });
}

export function createTemplate(input: {
  name: string;
  type: TemplateType;
  useCase: TemplateUseCase;
  companyId: string;
  companyName: string;
  language: TemplateLanguage;
  setDefault?: boolean;
}) {
  const now = new Date().toISOString();
  const id = `tpl-${Date.now()}`;
  const isDocument = input.type === "document" && isDocumentUseCase(input.useCase);
  const created: TemplateRecord = {
    id,
    name: input.name.trim(),
    type: input.type,
    useCase: input.useCase,
    companyId: input.companyId,
    companyName: input.companyName,
    language: input.language,
    status: "active",
    isDefault: Boolean(input.setDefault),
    isSystem: false,
    createdBy: "Current user",
    createdAt: now,
    updatedAt: now,
    documentConfig: isDocument ? defaultDocumentConfig() : undefined,
    emailConfig: !isDocument
      ? defaultEmailConfig(input.useCase as Parameters<typeof defaultEmailConfig>[0])
      : undefined,
  };

  let templates = [created, ...state.templates];
  if (created.isDefault) {
    templates = clearDefaultInScope(
      templates,
      created.companyId,
      created.useCase,
      created.language,
      created.id,
    );
  }
  state = { templates };
  emit();
  return created;
}

export function updateTemplate(
  id: string,
  patch: Partial<
    Pick<
      TemplateRecord,
      | "name"
      | "status"
      | "language"
      | "isDefault"
      | "documentConfig"
      | "emailConfig"
    >
  >,
) {
  const current = state.templates.find((item) => item.id === id);
  if (!current) return;

  let templates = state.templates.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      ...patch,
      documentConfig: patch.documentConfig
        ? { ...item.documentConfig, ...patch.documentConfig }
        : item.documentConfig,
      emailConfig: patch.emailConfig
        ? { ...item.emailConfig, ...patch.emailConfig }
        : item.emailConfig,
      updatedAt: new Date().toISOString(),
    } as TemplateRecord;
  });

  const next = templates.find((item) => item.id === id);
  if (next?.isDefault) {
    templates = clearDefaultInScope(
      templates,
      next.companyId,
      next.useCase,
      next.language,
      next.id,
    );
  }

  state = { templates };
  emit();
}

export function duplicateTemplate(id: string) {
  const source = state.templates.find((item) => item.id === id);
  if (!source) return null;
  const now = new Date().toISOString();
  const copy: TemplateRecord = {
    ...structuredClone(source),
    id: `tpl-${Date.now()}`,
    name: `${source.name} (copy)`,
    isDefault: false,
    isSystem: false,
    createdBy: "Current user",
    createdAt: now,
    updatedAt: now,
  };
  state = { templates: [copy, ...state.templates] };
  emit();
  return copy;
}

export function setTemplateDefault(id: string) {
  const current = state.templates.find((item) => item.id === id);
  if (!current) return;
  let templates = clearDefaultInScope(
    state.templates,
    current.companyId,
    current.useCase,
    current.language,
  );
  templates = templates.map((item) =>
    item.id === id
      ? {
          ...item,
          isDefault: true,
          status: "active" as TemplateStatus,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  state = { templates };
  emit();
}

export function setTemplateStatus(id: string, status: TemplateStatus) {
  // Status-only toggle: do not bump updatedAt so sort-by-updated keeps position.
  const current = state.templates.find((item) => item.id === id);
  if (!current || current.status === status) return;
  state = {
    templates: state.templates.map((item) =>
      item.id === id ? { ...item, status } : item,
    ),
  };
  emit();
}

export function deleteTemplate(id: string, replacementDefaultId?: string) {
  const current = state.templates.find((item) => item.id === id);
  if (!current) return { ok: false as const, reason: "missing" as const };
  if (current.isDefault && !replacementDefaultId) {
    return { ok: false as const, reason: "needs_replacement" as const };
  }
  let templates = state.templates.filter((item) => item.id !== id);
  if (current.isDefault && replacementDefaultId) {
    templates = clearDefaultInScope(
      templates,
      current.companyId,
      current.useCase,
      current.language,
    );
    templates = templates.map((item) =>
      item.id === replacementDefaultId
        ? { ...item, isDefault: true, status: "active" as const, updatedAt: new Date().toISOString() }
        : item,
    );
  }
  state = { templates };
  emit();
  return { ok: true as const };
}

export function patchDocumentConfig(
  id: string,
  patch: Partial<DocumentTemplateConfig>,
) {
  const current = state.templates.find((item) => item.id === id);
  if (!current?.documentConfig) return;
  updateTemplate(id, {
    documentConfig: { ...current.documentConfig, ...patch },
  });
}

export function patchEmailConfig(id: string, patch: Partial<EmailTemplateConfig>) {
  const current = state.templates.find((item) => item.id === id);
  if (!current?.emailConfig) return;
  updateTemplate(id, {
    emailConfig: { ...current.emailConfig, ...patch },
  });
}
