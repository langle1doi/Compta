import type {
  TemplateFilters,
  TemplateRecord,
  TemplatesKpis,
  TemplateUseCase,
} from "./model";

export function templatesKpis(templates: TemplateRecord[]): TemplatesKpis {
  return {
    total: templates.length,
    active: templates.filter((item) => item.status === "active").length,
    custom: templates.filter((item) => !item.isSystem).length,
    defaults: templates.filter((item) => item.isDefault).length,
  };
}

export function filterTemplates(
  templates: TemplateRecord[],
  filters: TemplateFilters,
) {
  const query = filters.search.trim().toLowerCase();
  const filtered = templates.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.useCase !== "all" && item.useCase !== filters.useCase) {
      return false;
    }
    if (filters.language !== "all" && item.language !== filters.language) {
      return false;
    }
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (!query) return true;
    return [item.name, item.companyName, item.useCase, item.language]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return [...filtered].sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    if (filters.sort === "created") {
      return b.createdAt.localeCompare(a.createdAt);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function defaultScopeKey(
  companyId: string,
  useCase: TemplateUseCase,
  language: string,
) {
  return `${companyId}::${useCase}::${language}`;
}

export function isDocumentUseCase(useCase: string) {
  return useCase === "quote" || useCase === "invoice" || useCase === "credit_note";
}
