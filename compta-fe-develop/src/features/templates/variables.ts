export type TemplateVariable = {
  key: string;
  label: string;
  group: "company" | "customer" | "quote" | "invoice" | "payment" | "dates";
};

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: "company.name", label: "Company name", group: "company" },
  { key: "company.address", label: "Company address", group: "company" },
  { key: "company.siret", label: "SIRET", group: "company" },
  { key: "company.vat_no", label: "VAT number", group: "company" },
  { key: "customer.name", label: "Customer name", group: "customer" },
  { key: "customer.address", label: "Customer address", group: "customer" },
  { key: "quote.number", label: "Quote number", group: "quote" },
  { key: "quote.date", label: "Quote date", group: "quote" },
  { key: "quote.valid_until", label: "Valid until", group: "quote" },
  { key: "quote.reference", label: "Quote reference", group: "quote" },
  { key: "quote.total", label: "Quote total", group: "quote" },
  { key: "invoice.number", label: "Invoice number", group: "invoice" },
  { key: "invoice.issue_date", label: "Issue date", group: "invoice" },
  { key: "invoice.due_date", label: "Due date", group: "invoice" },
  { key: "invoice.total", label: "Invoice total", group: "invoice" },
  { key: "payment.amount", label: "Payment amount", group: "payment" },
];

/** Safe placeholder substitution — no JS evaluation. */
export function substituteVariables(
  input: string,
  values: Record<string, string>,
) {
  return input.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi, (_, key: string) => {
    return values[key] ?? `{{${key}}}`;
  });
}
