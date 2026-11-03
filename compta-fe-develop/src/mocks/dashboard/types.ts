export type Tone = "blue" | "green" | "orange" | "red" | "purple" | "slate";

export type QuoteStatusKey =
  | "status.draft"
  | "status.sent"
  | "status.review"
  | "status.accepted"
  | "status.rejected"
  | "status.expired";

export type InvoiceStatusKey =
  | "status.overdue"
  | "status.partial"
  | "status.paid"
  | "status.open"
  | "status.dueSoon";

export type WorkKey =
  | "work.office"
  | "work.showroom"
  | "work.lighting"
  | "work.consulting"
  | "work.facade"
  | "work.electrical"
  | "work.hvac"
  | "work.joinery";

export type Quote = {
  id: string;
  customer: string;
  workKey: WorkKey;
  owner: string;
  amount: string;
  statusKey: QuoteStatusKey;
  tone: Tone;
};

export type Invoice = {
  id: string;
  customer: string;
  due: string;
  balance: string;
  statusKey: InvoiceStatusKey;
  tone: Tone;
};

export type ActionTitleKey =
  | "attention.overdueTitle"
  | "attention.reviewTitle"
  | "attention.bankTitle"
  | "attention.expiringTitle"
  | "attention.dueTodayTitle"
  | "attention.partialTitle"
  | "attention.replyTitle";

export type ActionMetaKey =
  | "attention.overdueMeta"
  | "attention.reviewMeta"
  | "attention.bankMeta"
  | "attention.expiringMeta"
  | "attention.dueTodayMeta"
  | "attention.partialMeta"
  | "attention.replyMeta";

export type ActionLinkKey =
  | "attention.reconcile"
  | "attention.approve"
  | "attention.check"
  | "attention.follow"
  | "attention.collect"
  | "attention.record"
  | "attention.reply";

export type ActionIconName =
  | "clock"
  | "shield"
  | "wallet"
  | "file"
  | "receipt"
  | "mail"
  | "calendar";

export type ActionItem = {
  id: string;
  titleKey: ActionTitleKey;
  titleValues: Record<string, string | number>;
  metaKey: ActionMetaKey;
  metaValues: Record<string, string | number>;
  actionKey: ActionLinkKey;
  tone: Tone;
  icon: ActionIconName;
};

export type PipelineStatusKey =
  | "status.draft"
  | "status.sent"
  | "status.review"
  | "status.accepted"
  | "status.rejected"
  | "status.expired";

export type PipelineStage = {
  labelKey: PipelineStatusKey;
  value: string;
  count: number;
  color: string;
};
