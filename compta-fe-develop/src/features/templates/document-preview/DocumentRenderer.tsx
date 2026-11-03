"use client";

import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { DocumentUseCase } from "../model";
import { DocumentPreviewFrame } from "./DocumentPreviewFrame";
import "./document-preview.css";
import type { DocumentRendererProps, RenderLineItem } from "./types";

function documentTitle(type: DocumentUseCase, language: string) {
  const map: Record<DocumentUseCase, Record<string, string>> = {
    quote: { fr: "Devis", en: "Quote", vi: "Báo giá" },
    invoice: { fr: "Facture", en: "Invoice", vi: "Hóa đơn" },
    credit_note: { fr: "Avoir", en: "Credit note", vi: "Phiếu giảm" },
  };
  return map[type][language] ?? map[type].en;
}

function partyLabels(language: string) {
  if (language === "fr") return { from: "De", to: "À" };
  if (language === "vi") return { from: "Từ", to: "Đến" };
  return { from: "From", to: "To" };
}

function metaLabels(language: string, type: DocumentUseCase) {
  const valid =
    type === "quote"
      ? language === "fr"
        ? "Valable jusqu'au"
        : language === "vi"
          ? "Hiệu lực đến"
          : "Valid until"
      : language === "fr"
        ? "Échéance"
        : language === "vi"
          ? "Hạn thanh toán"
          : "Due date";
  return {
    date: language === "fr" ? "Date" : language === "vi" ? "Ngày" : "Date",
    valid,
    reference:
      language === "fr" ? "Référence" : language === "vi" ? "Tham chiếu" : "Reference",
    currency:
      language === "fr" ? "Devise" : language === "vi" ? "Tiền tệ" : "Currency",
  };
}

function columnLabels(language: string) {
  if (language === "fr") {
    return {
      description: "Description",
      qty: "Qté",
      unit: "Unité",
      price: "P.U. HT",
      vat: "TVA",
      amount: "Montant",
    };
  }
  if (language === "vi") {
    return {
      description: "Mô tả",
      qty: "SL",
      unit: "ĐVT",
      price: "Đơn giá",
      vat: "VAT",
      amount: "Thành tiền",
    };
  }
  return {
    description: "Description",
    qty: "Qty",
    unit: "Unit",
    price: "Unit price",
    vat: "VAT",
    amount: "Amount",
  };
}

function totalsLabels(language: string) {
  if (language === "fr") {
    return {
      subtotal: "Sous-total HT",
      vat: "TVA",
      total: "Total TTC",
      deposit: "Acompte",
      terms: "Conditions",
    };
  }
  if (language === "vi") {
    return {
      subtotal: "Tạm tính",
      vat: "VAT",
      total: "Tổng cộng",
      deposit: "Tạm ứng",
      terms: "Điều khoản",
    };
  }
  return {
    subtotal: "Subtotal HT",
    vat: "VAT",
    total: "Total TTC",
    deposit: "Deposit",
    terms: "Terms & conditions",
  };
}

function formatDisplayDate(iso: string, language: string) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(
    language === "fr" ? "fr-FR" : language === "vi" ? "vi-VN" : "en-GB",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(date);
}

/** Safe terms: plain text lines / numbered list only — no raw HTML. */
function TermsContent({ terms }: { terms: string }) {
  const lines = terms
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const numbered = lines.every((line) => /^\d+[\).]\s+/.test(line));
  if (numbered) {
    return (
      <ol>
        {lines.map((line) => (
          <li key={line}>{line.replace(/^\d+[\).]\s+/, "")}</li>
        ))}
      </ol>
    );
  }

  return (
    <>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </>
  );
}

function companyIdentityBlock(
  company: DocumentRendererProps["company"],
  config: DocumentRendererProps["template"]["documentConfig"],
) {
  const parts: string[] = [];
  if (config.showCompanyAddress && company.address) parts.push(company.address);
  if (config.showSiret && company.siret) parts.push(`SIRET ${company.siret}`);
  if (config.showVatNumber && company.vatNumber) {
    parts.push(`VAT ${company.vatNumber}`);
  }
  return parts.join("\n");
}

function LineRow({
  line,
  config,
}: {
  line: RenderLineItem;
  config: DocumentRendererProps["template"]["documentConfig"];
}) {
  return (
    <tr>
      {config.showDescription ? (
        <td>
          <span className="template-document__item-title">{line.title}</span>
          {line.description ? (
            <span className="template-document__item-description">
              {line.description}
            </span>
          ) : null}
        </td>
      ) : null}
      {config.showQuantity ? (
        <td className="is-number">{line.quantity}</td>
      ) : null}
      {config.showUnit ? <td>{line.unit ?? "—"}</td> : null}
      {config.showUnitPrice ? (
        <td className="is-number">{formatMoneyFromCents(line.unitPriceCents)}</td>
      ) : null}
      {config.showDiscount ? (
        <td className="is-number">
          {line.discountPercent != null && line.discountPercent > 0
            ? `${line.discountPercent}%`
            : "—"}
        </td>
      ) : null}
      {config.showVat ? <td className="is-number">{line.vatRate}%</td> : null}
      {config.showAmount ? (
        <td className="is-number">{formatMoneyFromCents(line.amountCents)}</td>
      ) : null}
    </tr>
  );
}

function DocumentArticle({
  type,
  template,
  company,
  document,
  pageNumber = 1,
  pageCount = 1,
}: DocumentRendererProps) {
  const config = template.documentConfig;
  const language = template.language;
  const parties = partyLabels(language);
  const meta = metaLabels(language, type);
  const columns = columnLabels(language);
  const totals = totalsLabels(language);
  const address = companyIdentityBlock(company, config);
  const footerText =
    config.footer.trim() ||
    [
      company.name,
      company.siret ? `SIRET ${company.siret}` : null,
      company.vatNumber ? `VAT ${company.vatNumber}` : null,
      company.iban ? `IBAN ${company.iban}` : null,
      company.email,
    ]
      .filter(Boolean)
      .join(" · ");

  const style = {
    ["--doc-primary" as string]: config.primaryColor,
    ["--doc-primary-soft" as string]: config.accentColor,
    ["--doc-foreground" as string]: config.textColor,
  };

  return (
    <article className="template-document" style={style}>
      <header className="template-document__header">
        <div className="template-document__brand">
          {config.showLogo ? (
            company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- template logo from company branding URL
              <img
                alt={company.name}
                className="template-document__logo"
                src={company.logoUrl}
              />
            ) : (
              <span className="template-document__logo-fallback">
                {company.name}
              </span>
            )
          ) : null}
        </div>

        <div className="template-document__title-block">
          <h1 className="template-document__type">
            {document.title ?? documentTitle(type, language)}
          </h1>
          <div className="template-document__number">{document.number}</div>
        </div>
      </header>

      <section className="template-document__parties">
        <div>
          <div className="template-document__party-label">{parties.from}</div>
          <div className="template-document__company-name">{company.name}</div>
          {address ? (
            <div className="template-document__address">{address}</div>
          ) : null}
        </div>

        {config.showCustomerBlock ? (
          <div>
            <div className="template-document__party-label">{parties.to}</div>
            <div className="template-document__customer-name">
              {document.customer.name}
            </div>
            {document.customer.address ? (
              <div className="template-document__address">
                {document.customer.address}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="template-document__meta">
        <div className="template-document__meta-item">
          <span className="template-document__meta-label">{meta.date}</span>
          <span className="template-document__meta-value">
            {formatDisplayDate(document.date, language)}
          </span>
        </div>
        <div className="template-document__meta-item">
          <span className="template-document__meta-label">{meta.valid}</span>
          <span className="template-document__meta-value">
            {document.dueOrValidUntil
              ? formatDisplayDate(document.dueOrValidUntil, language)
              : "—"}
          </span>
        </div>
        <div className="template-document__meta-item">
          <span className="template-document__meta-label">{meta.reference}</span>
          <span className="template-document__meta-value">
            {document.reference ?? "—"}
          </span>
        </div>
        <div className="template-document__meta-item">
          <span className="template-document__meta-label">{meta.currency}</span>
          <span className="template-document__meta-value">{document.currency}</span>
        </div>
      </section>

      <section className="template-document__table-wrap">
        <table className="template-document__table">
          <thead>
            <tr>
              {config.showDescription ? (
                <th className="col-description">{columns.description}</th>
              ) : null}
              {config.showQuantity ? (
                <th className="col-qty is-number">{columns.qty}</th>
              ) : null}
              {config.showUnit ? <th className="col-unit">{columns.unit}</th> : null}
              {config.showUnitPrice ? (
                <th className="col-price is-number">{columns.price}</th>
              ) : null}
              {config.showDiscount ? (
                <th className="col-vat is-number">
                  {language === "fr" ? "Remise" : language === "vi" ? "CK" : "Disc."}
                </th>
              ) : null}
              {config.showVat ? (
                <th className="col-vat is-number">{columns.vat}</th>
              ) : null}
              {config.showAmount ? (
                <th className="col-total is-number">{columns.amount}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {document.lines.map((line) => (
              <LineRow config={config} key={line.id} line={line} />
            ))}
          </tbody>
        </table>
      </section>

      <div className="template-document__totals-wrap">
        <div className="template-document__totals">
          <div className="template-document__total-row">
            <span>{totals.subtotal}</span>
            <strong>{formatMoneyFromCents(document.totals.subtotalHtCents)}</strong>
          </div>
          <div className="template-document__total-row">
            <span>
              {totals.vat}
              {document.totals.vatRate != null
                ? ` ${document.totals.vatRate}%`
                : ""}
            </span>
            <strong>{formatMoneyFromCents(document.totals.vatCents)}</strong>
          </div>
          {document.totals.depositCents != null && document.totals.depositCents > 0 ? (
            <div className="template-document__total-row">
              <span>{totals.deposit}</span>
              <strong>
                {formatMoneyFromCents(document.totals.depositCents)}
              </strong>
            </div>
          ) : null}
          <div className="template-document__total-row template-document__total-row--grand">
            <span>{totals.total}</span>
            <strong>{formatMoneyFromCents(document.totals.totalTtcCents)}</strong>
          </div>
        </div>
      </div>

      {config.terms.trim() ? (
        <section className="template-document__terms">
          <h2 className="template-document__terms-title">{totals.terms}</h2>
          <div className="template-document__terms-content">
            <TermsContent terms={config.terms} />
          </div>
        </section>
      ) : null}

      {document.note ? (
        <div className="template-document__note">{document.note}</div>
      ) : null}

      <footer className="template-document__footer">
        <div className="template-document__footer-grid">
          <div className="template-document__footer-text">{footerText}</div>
          {config.showPageNumber ? (
            <div className="template-document__page-number">
              Page {pageNumber} / {pageCount}
            </div>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

/**
 * Presentation-only document renderer.
 * Receives canonical document data as props — does not fetch or recalculate totals.
 */
export function DocumentRenderer(props: DocumentRendererProps) {
  const article = <DocumentArticle {...props} />;
  const mode = props.mode ?? "preview";

  if (mode === "full") {
    return article;
  }

  return (
    <DocumentPreviewFrame
      className="h-full min-h-0"
      expandLabel={props.expandLabel}
      label={mode === "thumbnail" ? undefined : "Live preview"}
      variant={mode === "thumbnail" ? "thumbnail" : "panel"}
      onExpand={props.onExpand}
    >
      {article}
    </DocumentPreviewFrame>
  );
}

export function DocumentPreviewShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("document-preview-shell", className)}>{children}</div>
  );
}
